import dotenv from 'dotenv';
import express from 'express';
import { webhookCallback } from 'grammy';
import path from 'path';
import { processAiMessage, resetUserSession } from './server/geminiService';
import { rateLimiter } from './server/rateLimiter';
import {
  addBotLog,
  clearRecentLogs,
  getAdminWhitelist,
  getRecentLogs,
  getStatsCounters,
  getTelegramBot,
  initTelegramBot,
} from './server/telegramBot';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const startTime = Date.now();

// Helper to dynamically resolve app base URL from request or environment
export function resolveAppBaseUrl(req?: express.Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && !envUrl.includes('MY_APP_URL') && !envUrl.includes('ais-dev-') && !envUrl.includes('ais-pre-') && envUrl.trim() !== '') {
    const clean = envUrl.replace(/\/+$/, '');
    return clean.startsWith('http://') ? clean.replace(/^http:\/\//, 'https://') : (clean.startsWith('https://') ? clean : `https://${clean}`);
  }
  if (req) {
    const hostHeader = req.headers['x-forwarded-host'];
    const host = typeof hostHeader === 'string' ? hostHeader.split(',')[0].trim() : req.headers.host;
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `https://${host}`;
    }
  }
  return '';
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check Endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    message: 'Telegram AI Bot Server is running.',
  });
});

// Telegram Webhook Handler (grammY express webhook middleware)
app.post('/api/telegram/webhook', async (req, res, next) => {
  const bot = await initTelegramBot();
  if (!bot) {
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;
    if (update?.message) {
      const fromUser = update.message.from;
      const textPreview = update.message.text
        ? `"${update.message.text.substring(0, 30)}"`
        : update.message.photo
        ? '[تصویر]'
        : update.message.voice
        ? '[صدا]'
        : update.message.document
        ? '[فایل]'
        : '[پیام]';
      addBotLog({
        type: 'webhook_in',
        message: `📥 [Webhook] پیام ورودی از @${fromUser?.username || fromUser?.first_name || 'کاربر'}: ${textPreview}`,
        user: {
          id: fromUser?.id,
          username: fromUser?.username,
          firstName: fromUser?.first_name,
        },
      });
    }
  } catch (e) {
    // Non-blocking log catch
  }

  const handle = webhookCallback(bot, 'express', 'return', 60000);
  return handle(req, res);
});

// Bot & Webhook Status Endpoint
app.get('/api/telegram/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const hasToken = Boolean(token && token !== 'MY_BOT_TOKEN' && token.trim() !== '');
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const dynamicOrigin = resolveAppBaseUrl(req);
  const adminIds = getAdminWhitelist();

  let botInfo: any = null;
  let webhookInfo: any = null;

  if (hasToken) {
    const bot = getTelegramBot();
    if (bot) {
      try {
        const me = await bot.api.getMe();
        botInfo = {
          id: me.id,
          firstName: me.first_name,
          username: me.username,
          canJoinGroups: me.can_join_groups,
        };

        const wh = await bot.api.getWebhookInfo();
        webhookInfo = {
          url: wh.url,
          hasCustomCertificate: wh.has_custom_certificate,
          pendingUpdateCount: wh.pending_update_count,
          lastErrorDate: wh.last_error_date,
          lastErrorMessage: wh.last_error_message,
          maxConnections: wh.max_connections,
        };
      } catch (err: any) {
        console.warn('[Status Fetch Warning]', err?.message || err);
      }
    }
  }

  const cleanAppUrl = dynamicOrigin;
  const webhookEndpoint = cleanAppUrl ? `${cleanAppUrl}/api/telegram/webhook` : '';

  res.json({
    isConfigured: hasToken,
    hasGeminiKey,
    botInfo,
    webhookInfo,
    connectionMode: 'webhook',
    adminIds,
    appUrl: cleanAppUrl,
    webhookEndpoint,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

// Send Test Message to Admin ID
app.post('/api/telegram/test-message', async (req, res) => {
  const bot = getTelegramBot();
  if (!bot) {
    return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not set' });
  }

  const adminIds = getAdminWhitelist();
  if (adminIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No TELEGRAM_ADMIN_ID is configured in environment.',
    });
  }

  const targetId = req.body.chatId || adminIds[0];
  const messageText = req.body.text || '🔔 پیام تستی از پنل مدیریت کلودران: اتصال به ربات تلگرام برقرار است!';

  try {
    await bot.api.sendMessage(targetId, messageText, { parse_mode: 'Markdown' });
    addBotLog({
      type: 'telegram_out',
      message: `Sent test message to Admin (${targetId})`,
    });
    res.json({ success: true, sentTo: targetId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to send message' });
  }
});

// App Stats & Logs
app.get('/api/stats', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(getStatsCounters());
});

app.post('/api/logs/clear', (req, res) => {
  clearRecentLogs();
  res.json({ success: true, message: 'Logs cleared successfully' });
});

// Simulator AI Generation Endpoint
app.post('/api/test-ai', async (req, res) => {
  const { prompt, sessionId = 'web-simulator-session', media } = req.body;
  if (!prompt && !media) {
    return res.status(400).json({ error: 'Prompt or media is required' });
  }

  try {
    const result = await processAiMessage({
      sessionId,
      userPrompt: prompt || '',
      media,
      onLog: (l) => {
        addBotLog({
          type: l.type as any,
          message: `[Simulator] ${l.message}`,
          modelUsed: l.model,
        });
      },
    });

    res.json({
      replyText: result.replyText,
      modelUsed: result.modelUsed,
      tierUsed: result.tierUsed,
      hasPdf: Boolean(result.pdfBuffer),
      pdfBase64: result.pdfBuffer ? result.pdfBuffer.toString('base64') : undefined,
      pdfFilename: result.pdfFilename,
      groundingUrls: result.groundingUrls,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI Generation error' });
  }
});

// Reset Simulator Session
app.post('/api/reset-session', (req, res) => {
  const { sessionId = 'web-simulator-session' } = req.body;
  resetUserSession(sessionId);
  res.json({ success: true, message: 'Session reset successfully' });
});

// Reset Rate Limits manually
app.post('/api/rate-limit/reset', (req, res) => {
  rateLimiter.resetAllManually();
  res.json({ success: true, message: 'Rate limits reset' });
});

// ----------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} (PORT=${PORT})`);
    initTelegramBot().catch((err) => console.warn('[Bot Init Notice]', err?.message));
  });
}

startServer();
