import { Bot, InlineKeyboard, InputFile } from 'grammy';
import * as pdfParse from 'pdf-parse';
import { getFullDateTimeInfo } from './dateUtils';
import { getActiveSessionCount, processAiMessage, resetUserSession } from './geminiService';
import { rateLimiter } from './rateLimiter';

export interface BotLog {
  id: string;
  timestamp: string;
  type: 'webhook_in' | 'gemini_req' | 'gemini_fallback' | 'tool_call' | 'telegram_out' | 'error' | 'security';
  message: string;
  details?: Record<string, unknown>;
  modelUsed?: string;
  user?: {
    id?: number;
    username?: string;
    firstName?: string;
  };
}

// In-memory event logs for Web Dashboard
const eventLogs: BotLog[] = [];
const MAX_LOGS = 100;

export function addBotLog(log: Omit<BotLog, 'id' | 'timestamp'>) {
  const entry: BotLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    ...log,
  };
  eventLogs.unshift(entry);
  if (eventLogs.length > MAX_LOGS) {
    eventLogs.pop();
  }
}

export function getRecentLogs(): BotLog[] {
  return eventLogs;
}

export function clearRecentLogs(): void {
  eventLogs.length = 0;
}

// Global counters
let totalMessagesProcessed = 0;
let totalPdfGenerated = 0;
let totalPhotosProcessed = 0;
let totalAudioProcessed = 0;
let totalVideosProcessed = 0;
let totalFallbacksTriggered = 0;

export function getStatsCounters() {
  return {
    totalMessagesProcessed,
    totalPdfGenerated,
    totalPhotosProcessed,
    totalAudioProcessed,
    totalVideosProcessed,
    totalFallbacksTriggered,
    activeSessionsCount: getActiveSessionCount(),
    tiers: rateLimiter.getTiersStatus(),
    recentLogs: getRecentLogs(),
  };
}

let currentBotToken = '';
let botInstance: Bot | null = null;

export function resetBotInstance(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'MY_BOT_TOKEN' || token.trim() === '') {
    return null;
  }
  currentBotToken = token;
  botInstance = new Bot(token);
  setupBotHandlers(botInstance);
  return botInstance;
}

export function getTelegramBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'MY_BOT_TOKEN' || token.trim() === '') {
    return null;
  }
  if (!botInstance || currentBotToken !== token) {
    return resetBotInstance();
  }
  return botInstance;
}

export async function initTelegramBot(): Promise<Bot | null> {
  const bot = getTelegramBot();
  if (bot) {
    try {
      if (!bot.isInited()) {
        await bot.init();
      }
    } catch (e) {
      console.warn('[Bot Init Error]', e);
    }
  }
  return bot;
}

export function getAdminWhitelist(): string[] {
  const raw = process.env.TELEGRAM_ADMIN_ID || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isUserAuthorized(userId?: number): boolean {
  const whitelist = getAdminWhitelist();
  // If no admin ID is configured at all, default to open for initial setup
  if (whitelist.length === 0) {
    return true;
  }
  if (!userId) return false;
  return whitelist.includes(String(userId));
}

function splitMessage(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }
    let sliceIndex = remaining.lastIndexOf('\n', maxLength);
    if (sliceIndex === -1 || sliceIndex < maxLength / 2) {
      sliceIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (sliceIndex === -1) {
      sliceIndex = maxLength;
    }
    parts.push(remaining.substring(0, sliceIndex));
    remaining = remaining.substring(sliceIndex).trimStart();
  }
  return parts;
}

function getMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🆕 گفتگوی جدید (New Chat)', 'action_new_chat')
    .row()
    .text('📊 وضعیت مدل‌ها (Status)', 'action_status')
    .text('📄 راهنما (Help)', 'action_help');
}

async function safeSendReply(ctx: any, text: string, options: any = {}) {
  try {
    return await ctx.reply(text, { parse_mode: 'Markdown', ...options });
  } catch (err) {
    // If Markdown parsing fails due to Telegram markdown formatting rules, send plain text
    try {
      const cleanOpts = { ...options };
      delete cleanOpts.parse_mode;
      return await ctx.reply(text, cleanOpts);
    } catch (innerErr) {
      console.error('[Telegram Reply Error]', innerErr);
    }
  }
}

function setupBotHandlers(bot: Bot) {
  // Authorization Middleware
  bot.use(async (ctx, next) => {
    const user = ctx.from;
    const updateKind = ctx.message ? 'message' : Object.keys(ctx.update)[1] || 'update';
    addBotLog({
      type: 'webhook_in',
      message: `Incoming update: ${ctx.update.update_id} (${ctx.message?.text ? `"${ctx.message.text.substring(0, 30)}..."` : updateKind})`,
      user: user
        ? {
            id: user.id,
            username: user.username,
            firstName: user.first_name,
          }
        : undefined,
    });

    if (!isUserAuthorized(user?.id)) {
      addBotLog({
        type: 'security',
        message: `Blocked unauthorized access from User ID: ${user?.id} (@${user?.username || 'no_username'})`,
        user: user ? { id: user.id, username: user.username, firstName: user.first_name } : undefined,
      });

      if (ctx.chat?.id) {
        await safeSendReply(
          ctx,
          `⛔️ **دسترسی غیرمجاز (Unauthorized)**\n\nاین ربات به صورت خصوصی برای استفاده ادمین پیکربندی شده است.\nشناسه عددی تلگرام شما: \`${user?.id}\`\n\nبرای اجازه دسترسی، شناسه‌ی بالا را در تنظیمات ربات وارد نمایید.`
        );
      }
      return;
    }

    await next();
  });

  // /start command
  bot.command('start', async (ctx) => {
    const dt = getFullDateTimeInfo();
    const welcomeMsg = `👋 **درود بر شما! به دستیار هوشمند Gemini خوش آمدید.**

🗓️ **امروز:** ${dt.shamsi.formatted}
⏰ **ساعت:** ${dt.time.hours.toString().padStart(2, '0')}:${dt.time.minutes.toString().padStart(2, '0')} (تهران)

⚡️ **امکانات فعال:**
• 🧠 اتصال هوشمند به زنجیره Flash Lite
• 🖼️ تحلیل تصویر و عکس
• 🎙️ درک پیام صوتی و ویس
• 📄 خواندن و تحلیل فایل‌ها و اسناد
• 📅 تقویم دقیق شمسی و میلادی

یک پیام بفرستید تا گفتگو آغاز شود:`;

    await safeSendReply(ctx, welcomeMsg, {
      reply_markup: getMainKeyboard(),
    });
  });

  // /new & /reset command
  bot.command(['new', 'reset'], async (ctx) => {
    if (ctx.chat?.id) {
      resetUserSession(String(ctx.chat.id));
      await safeSendReply(ctx, '✨ **حافظه گفتگو پاک شد و گفتگوی جدید آغاز گردید.**', {
        reply_markup: getMainKeyboard(),
      });
    }
  });

  // /status command
  bot.command('status', async (ctx) => {
    const stats = rateLimiter.getTiersStatus();
    const dt = getFullDateTimeInfo();
    let statusText = `📊 **وضعیت سهمیه و مدل‌های هوش مصنوعی:**\n\n🗓️ **تاریخ:** ${dt.shamsi.formatted}\n\n`;

    stats.forEach((t) => {
      const icon = t.status === 'active' ? '🟢' : t.status === 'rate_limited' ? '🟡' : '⚪️';
      statusText += `${icon} **Tier ${t.tier} (${t.modelId})**\n• مصرف در دقیقه: ${t.currentRpm} / ${t.rpmLimit} RPM\n• مصرف امروز: ${t.currentRpd} / ${t.rpdLimit} RPD\n• وضعیت: \`${t.status}\`\n\n`;
    });

    statusText += `👥 جلسات فعال در حافظه: ${getActiveSessionCount()}\n🔄 ریست خودکار سهمیه روزانه: هر ۲۴ ساعت ساعت ۰۰:۰۰ UTC`;

    await safeSendReply(ctx, statusText, { reply_markup: getMainKeyboard() });
  });

  // /help command
  bot.command('help', async (ctx) => {
    const helpText = `📖 **راهنمای استفاده از ربات:**

1️⃣ **پرسش و گفتگو:** هر سوال علمی، برنامه‌نویسی، روزمره یا تحلیلی دارید مطرح کنید.
2️⃣ **تحلیل تصویر و عکس:** عکس ارسال کنید و سوال یا ترجمه متن داخل آن را بپرسید.
3️⃣ **پیام صوتی:** ویس یا فایل صوتی بفرستید تا متن آن را درک کرده و پاسخ دهد.
4️⃣ **خواندن و تحلیل فایل‌ها:** ارسال اسناد متنی و PDF جهت خلاصه، بررسی یا تحلیل.
5️⃣ **تاریخ و زمان:** اطلاع از تاریخ و ساعت دقیق.
6️⃣ **/new:** شروع گفتگوی جدید و پاکسازی حافظه موقت.`;

    await safeSendReply(ctx, helpText, { reply_markup: getMainKeyboard() });
  });

  // Handle Callback Queries (Buttons)
  bot.on('callback_query:data', async (ctx) => {
    const action = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    if (action === 'action_new_chat') {
      if (ctx.chat?.id) {
        resetUserSession(String(ctx.chat.id));
        await ctx.reply('✨ **حافظه گفتگو پاک شد و گفتگوی جدید آغاز گردید.**', {
          parse_mode: 'Markdown',
          reply_markup: getMainKeyboard(),
        });
      }
    } else if (action === 'action_status') {
      const stats = rateLimiter.getTiersStatus();
      let statusText = `📊 **وضعیت سهمیه مدل‌ها:**\n\n`;
      stats.forEach((t) => {
        const icon = t.status === 'active' ? '🟢' : '🟡';
        statusText += `${icon} **Tier ${t.tier}**: ${t.currentRpm}/${t.rpmLimit} RPM | امروز: ${t.currentRpd}/${t.rpdLimit} RPD\n`;
      });
      await ctx.reply(statusText, { parse_mode: 'Markdown' });
    } else if (action === 'action_help') {
      await ctx.reply(
        '💡 برای شروع مجدد /start یا برای پاکسازی حافظه /new را بفرستید. می‌توانید عکس، صدا یا متن ارسال کنید.',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Photo Messages
  bot.on('message:photo', async (ctx) => {
    totalPhotosProcessed += 1;
    totalMessagesProcessed += 1;
    const chatId = String(ctx.chat.id);
    const caption = ctx.message.caption || 'لطفاً این تصویر را بررسی و توضیح بده.';

    try {
      await ctx.replyWithChatAction('typing');

      // Get highest resolution photo
      const photo = ctx.message.photo.pop();
      if (!photo) return;

      const file = await ctx.api.getFile(photo.file_id);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const res = await fetch(downloadUrl);
      const arrayBuffer = await res.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      const result = await processAiMessage({
        sessionId: chatId,
        userPrompt: caption,
        media: {
          mimeType: 'image/jpeg',
          base64Data,
        },
        onLog: (l) => {
          addBotLog({
            type: l.type as any,
            message: l.message,
            modelUsed: l.model,
            user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
          });
          if (l.type === 'gemini_fallback') totalFallbacksTriggered += 1;
        },
      });

      if (result.pdfBuffer) {
        totalPdfGenerated += 1;
        await ctx.replyWithDocument(new InputFile(result.pdfBuffer, result.pdfFilename || 'report.pdf'), {
          caption: `📄 **فایل PDF تولید شده توسط هوش مصنوعی**`,
          parse_mode: 'Markdown',
        });
      }

      const chunks = splitMessage(result.replyText);
      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        } catch {
          await ctx.reply(chunk);
        }
      }
    } catch (err: any) {
      addBotLog({
        type: 'error',
        message: `Photo handling error: ${err?.message || err}`,
      });
      await ctx.reply(`⚠️ خطا در پردازش تصویر: ${err?.message || 'لطفاً دوباره تلاش کنید.'}`);
    }
  });

  // Voice / Audio Messages
  bot.on(['message:voice', 'message:audio'], async (ctx) => {
    totalAudioProcessed += 1;
    totalMessagesProcessed += 1;
    const chatId = String(ctx.chat.id);

    try {
      await ctx.replyWithChatAction('typing');

      const voice = ctx.message.voice || ctx.message.audio;
      if (!voice) return;

      const file = await ctx.api.getFile(voice.file_id);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const res = await fetch(downloadUrl);
      const arrayBuffer = await res.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = ctx.message.voice ? 'audio/ogg' : ctx.message.audio?.mime_type || 'audio/mp3';

      const result = await processAiMessage({
        sessionId: chatId,
        userPrompt: 'پیام صوتی کاربر را گوش بده، متن آن را متوجه شو و پاسخ کامل ارائه بده.',
        media: {
          mimeType,
          base64Data,
        },
        onLog: (l) => {
          addBotLog({
            type: l.type as any,
            message: l.message,
            modelUsed: l.model,
            user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
          });
          if (l.type === 'gemini_fallback') totalFallbacksTriggered += 1;
        },
      });

      const chunks = splitMessage(result.replyText);
      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        } catch {
          await ctx.reply(chunk);
        }
      }
    } catch (err: any) {
      addBotLog({
        type: 'error',
        message: `Voice handling error: ${err?.message || err}`,
      });
      await ctx.reply(`⚠️ خطا در پردازش صوت: ${err?.message || 'لطفاً دوباره تلاش کنید.'}`);
    }
  });

  // Video Processing Helper
  async function notifyVideoNotSupported(ctx: any) {
    totalMessagesProcessed += 1;
    await safeSendReply(
      ctx,
      `🎥 **اطلاعیه در خصوص ویدیو:**\n\nبه دلیل محدودیت‌های مدل‌های سبک Flash Lite، پردازش و تحلیل فیلم و ویدیو پشتیبانی نمی‌شود.\n\n💡 **شما می‌توانید به جای ویدیو از موارد زیر استفاده کنید:**\n• ارسال **عکس و اسکرین‌شات** از صحنه موردنظر\n• ارسال **پیام صوتی و ویس**\n• ارسال **متن یا فایل سند (PDF / TXT)**`
    );
  }

  // 1. Gallery Video Messages
  bot.on('message:video', async (ctx) => {
    await notifyVideoNotSupported(ctx);
  });

  // 2. Video Note (Circular / Round Video Messages)
  bot.on('message:video_note', async (ctx) => {
    await notifyVideoNotSupported(ctx);
  });

  // 3. Animation / GIF Messages
  bot.on('message:animation', async (ctx) => {
    await notifyVideoNotSupported(ctx);
  });

  // Document Messages (Handles Videos sent as files, Audios as files, Images as files, PDFs, TXT, etc.)
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    if (!doc) return;
    const chatId = String(ctx.chat.id);
    const fileName = doc.file_name || 'document';
    const lowerName = fileName.toLowerCase();
    const mime = (doc.mime_type || '').toLowerCase();
    const caption = ctx.message.caption || '';

    // A. Video sent as a File / Document
    const isVideoDoc = mime.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm|flv|3gp|wmv|m4v)$/i.test(lowerName);
    if (isVideoDoc) {
      await notifyVideoNotSupported(ctx);
      return;
    }

    // B. Audio sent as a File / Document
    const isAudioDoc = mime.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|aac|flac|wma)$/i.test(lowerName);
    if (isAudioDoc) {
      totalAudioProcessed += 1;
      totalMessagesProcessed += 1;
      try {
        await ctx.replyWithChatAction('typing');
        const file = await ctx.api.getFile(doc.file_id);
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
        const arrayBuffer = await res.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const result = await processAiMessage({
          sessionId: chatId,
          userPrompt: caption || 'این فایل صوتی را بشنو و تحلیل کن.',
          media: {
            mimeType: doc.mime_type || 'audio/mp3',
            base64Data,
            fileName,
          },
          onLog: (l) => {
            addBotLog({
              type: l.type as any,
              message: l.message,
              modelUsed: l.model,
              user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
            });
            if (l.type === 'gemini_fallback') totalFallbacksTriggered += 1;
          },
        });
        const chunks = splitMessage(result.replyText);
        for (const chunk of chunks) {
          try {
            await ctx.reply(chunk, { parse_mode: 'Markdown' });
          } catch {
            await ctx.reply(chunk);
          }
        }
      } catch (err: any) {
        addBotLog({ type: 'error', message: `Audio doc error: ${err?.message || err}` });
        await ctx.reply(`⚠️ خطا در پردازش فایل صوتی: ${err?.message || 'خطا در ارتباط'}`);
      }
      return;
    }

    // C. Image sent as a File / Document
    const isImageDoc = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|heic|heif)$/i.test(lowerName);
    if (isImageDoc) {
      totalPhotosProcessed += 1;
      totalMessagesProcessed += 1;
      try {
        await ctx.replyWithChatAction('typing');
        const file = await ctx.api.getFile(doc.file_id);
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
        const arrayBuffer = await res.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const result = await processAiMessage({
          sessionId: chatId,
          userPrompt: caption || 'این تصویر ارسالی را تحلیل کن.',
          media: {
            mimeType: doc.mime_type || 'image/jpeg',
            base64Data,
            fileName,
          },
          onLog: (l) => {
            addBotLog({
              type: l.type as any,
              message: l.message,
              modelUsed: l.model,
              user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
            });
            if (l.type === 'gemini_fallback') totalFallbacksTriggered += 1;
          },
        });
        const chunks = splitMessage(result.replyText);
        for (const chunk of chunks) {
          try {
            await ctx.reply(chunk, { parse_mode: 'Markdown' });
          } catch {
            await ctx.reply(chunk);
          }
        }
      } catch (err: any) {
        addBotLog({ type: 'error', message: `Image doc error: ${err?.message || err}` });
        await ctx.reply(`⚠️ خطا در پردازش فایل تصویر: ${err?.message || 'خطا در ارتباط'}`);
      }
      return;
    }

    // D. PDF and Text Documents
    totalMessagesProcessed += 1;
    try {
      await ctx.replyWithChatAction('typing');

      const file = await ctx.api.getFile(doc.file_id);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const res = await fetch(downloadUrl);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extractedText = '';
      const isPdf = doc.mime_type === 'application/pdf' || lowerName.endsWith('.pdf');

      if (isPdf) {
        try {
          const fn = (pdfParse as any).default || pdfParse;
          if (typeof fn === 'function') {
            const parsed = await fn(buffer);
            extractedText = parsed?.text || '';
          } else if ((pdfParse as any).PDFParse) {
            const parser = new (pdfParse as any).PDFParse();
            const parsed = await parser.parseBuffer(buffer);
            extractedText = parsed?.text || '';
          }
        } catch (pdfErr) {
          console.warn('[PDF] Error extracting text with pdf-parse:', pdfErr);
        }
      } else if (doc.mime_type?.startsWith('text/') || /\.(txt|csv|md|json|js|ts|py|html|css|xml)$/i.test(lowerName)) {
        extractedText = buffer.toString('utf-8');
      }

      // Safe truncate if very large to respect TPM (Tokens Per Minute) quota
      if (extractedText.length > 30000) {
        extractedText = extractedText.substring(0, 30000) + '\n... [متن به دلیل مدیریت محدودیت توکن در دقیقه به ۳۰ هزار کاراکتر اول محدود شد]';
      }

      const promptWithDoc = extractedText
        ? `[سند ارسالی کاربر: ${doc.file_name || 'Document'}]\n${extractedText}\n\n[درخواست کاربر]: ${caption || 'لطفاً این سند را بررسی و خلاصه کن.'}`
        : (caption || 'لطفاً این فایل را بررسی کن.');

      const result = await processAiMessage({
        sessionId: chatId,
        userPrompt: promptWithDoc,
        media: isPdf
          ? {
              mimeType: 'application/pdf',
              base64Data: buffer.toString('base64'),
              fileName: doc.file_name,
            }
          : undefined,
        onLog: (l) => {
          addBotLog({
            type: l.type as any,
            message: l.message,
            modelUsed: l.model,
            user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
          });
          if (l.type === 'gemini_fallback') totalFallbacksTriggered += 1;
        },
      });

      if (result.pdfBuffer) {
        totalPdfGenerated += 1;
        await ctx.replyWithDocument(new InputFile(result.pdfBuffer, result.pdfFilename || 'translation_report.pdf'), {
          caption: `📄 **فایل PDF تولید شده**`,
          parse_mode: 'Markdown',
        });
      }

      const chunks = splitMessage(result.replyText);
      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        } catch {
          await ctx.reply(chunk);
        }
      }
    } catch (err: any) {
      addBotLog({
        type: 'error',
        message: `Document handling error: ${err?.message || err}`,
      });
      await ctx.reply(`⚠️ خطا در پردازش سند: ${err?.message || 'لطفاً دوباره تلاش کنید.'}`);
    }
  });

  // Standard Text Messages
  bot.on('message:text', async (ctx) => {
    totalMessagesProcessed += 1;
    const chatId = String(ctx.chat.id);
    const text = ctx.message.text;

    try {
      await ctx.replyWithChatAction('typing');

      const result = await processAiMessage({
        sessionId: chatId,
        userPrompt: text,
        onLog: (l) => {
          addBotLog({
            type: l.type as any,
            message: l.message,
            modelUsed: l.model,
            user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
          });
          if (l.type === 'gemini_fallback') totalFallbacksTriggered += 1;
        },
      });

      // Send PDF if generated by tool
      if (result.pdfBuffer) {
        totalPdfGenerated += 1;
        await ctx.replyWithDocument(new InputFile(result.pdfBuffer, result.pdfFilename || 'report.pdf'), {
          caption: `📄 **فایل PDF با موفقیت ایجاد شد**`,
          parse_mode: 'Markdown',
        });
      }

      // Format with Grounding links if any
      let finalReply = result.replyText;
      if (result.groundingUrls && result.groundingUrls.length > 0) {
        finalReply += '\n\n🌐 **منابع استخراج شده از گوگل:**\n';
        result.groundingUrls.slice(0, 4).forEach((g, idx) => {
          finalReply += `${idx + 1}. [${g.title.replace(/[[\]]/g, '')}](${g.uri})\n`;
        });
      }

      addBotLog({
        type: 'telegram_out',
        message: `Sent reply to ${ctx.from.first_name} (via ${result.modelUsed} - Tier ${result.tierUsed})`,
        modelUsed: result.modelUsed,
        user: { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name },
      });

      const chunks = splitMessage(finalReply);
      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        } catch {
          await ctx.reply(chunk);
        }
      }
    } catch (err: any) {
      addBotLog({
        type: 'error',
        message: `AI Generation error: ${err?.message || err}`,
      });
      await ctx.reply(`⚠️ خطا در دریافت پاسخ از هوش مصنوعی: ${err?.message || 'لطفاً دوباره تلاش کنید.'}`);
    }
  });

  bot.catch((err) => {
    console.error('[Grammy Error]', err);
    addBotLog({
      type: 'error',
      message: `Telegram Bot Catch: ${err.message || 'Unknown error'}`,
    });
  });
}
