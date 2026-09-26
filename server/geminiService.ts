import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import { getFullDateTimeInfo } from './dateUtils';
import { createPdfBuffer } from './pdfGenerator';
import { rateLimiter, TIER_CONFIGS } from './rateLimiter';

// Session history item
export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

// User memory store in-memory (keyed by telegram chat_id or simulator session id)
const userSessions = new Map<string, ChatMessage[]>();

// Maximum messages kept in history per chat to conserve token window
const MAX_HISTORY_MESSAGES = 14;

let cachedApiKey = '';
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is not configured in environment or Secrets panel.');
  }
  if (!aiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function resetUserSession(chatId: string) {
  userSessions.delete(chatId);
}

export function getActiveSessionCount(): number {
  return userSessions.size;
}

// Function Declarations
const generatePdfTool: FunctionDeclaration = {
  name: 'generatePdfDocument',
  description: 'Generates a downloadable, beautifully formatted PDF document for research, translation, or long summaries requested by the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The title of the PDF document',
      },
      subtitle: {
        type: Type.STRING,
        description: 'Optional subtitle',
      },
      content: {
        type: Type.STRING,
        description:
          'The structured body text for the PDF document. Use clear paragraphs, headings (# and ##), and bullet points. DO NOT repeat the document title at the beginning. DO NOT use raw pipe markdown tables (|) or raw divider dashes (---); format comparisons as clear bullet points. DO NOT add signatures, page numbers, or dates at the end.',
      },
    },
    required: ['title', 'content'],
  },
};

export interface ProcessAiInput {
  sessionId: string;
  userPrompt: string;
  media?: {
    mimeType: string;
    base64Data: string;
    fileName?: string;
  };
  onLog?: (log: { type: string; message: string; model?: string }) => void;
}

export interface ProcessAiOutput {
  replyText: string;
  modelUsed: string;
  tierUsed: number;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  groundingUrls?: Array<{ uri: string; title: string }>;
}

export async function processAiMessage(input: ProcessAiInput): Promise<ProcessAiOutput> {
  const ai = getAiClient();
  const sessionId = input.sessionId;

  // Retrieve or create chat history
  let history = userSessions.get(sessionId) || [];
  if (history.length > MAX_HISTORY_MESSAGES) {
    history = history.slice(-MAX_HISTORY_MESSAGES);
  }

  // Build the new user message part
  const userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (input.media) {
    userParts.push({
      inlineData: {
        mimeType: input.media.mimeType,
        data: input.media.base64Data,
      },
    });
  }
  if (input.userPrompt) {
    userParts.push({ text: input.userPrompt });
  } else if (input.media && userParts.length === 1) {
    userParts.push({ text: 'Please analyze this file/image.' });
  }

  const currentMessage: ChatMessage = {
    role: 'user',
    parts: userParts,
  };

  const fullContents = [...history, currentMessage];

  // Determine if this request is a document / file analysis
  const hasMedia = Boolean(input.media);
  const isLargeDocPrompt = input.userPrompt.length > 2500;
  const isDocumentRequest = hasMedia || isLargeDocPrompt;

  // Build lightweight user message for history saving to protect TPM quota and prevent payload inflation
  let historyUserMessageParts: Array<{ text: string }> = [];
  if (input.media) {
    historyUserMessageParts.push({
      text: `[فایل چندرسانه‌ای ارسالی کاربر: ${input.media.fileName || input.media.mimeType}]`,
    });
  }
  if (input.userPrompt) {
    const textContent = isLargeDocPrompt
      ? `${input.userPrompt.substring(0, 1500)}\n\n[... خلاصه شده در تاریخچه گفتگو برای مدیریت سهمیه ...] `
      : input.userPrompt;
    historyUserMessageParts.push({ text: textContent });
  }

  // System instruction with real-time context
  const dateContext = getFullDateTimeInfo();
  const systemInstruction = `You are a high-intelligence, friendly, and helpful Telegram AI Assistant powered by Google Gemini.
You are running as a dedicated bot for the user.
Real-Time Context:
- Current Shamsi Date: ${dateContext.shamsi.formatted}
- Current Gregorian Date: ${dateContext.gregorian.formatted}
- Current Tehran Time: ${dateContext.time.hours.toString().padStart(2, '0')}:${dateContext.time.minutes.toString().padStart(2, '0')}:${dateContext.time.seconds.toString().padStart(2, '0')}
- Full Timestamp: ${dateContext.fullSummary}

Guidelines:
1. Always communicate in the language the user speaks (Persian/Farsi by default if spoken in Persian, English if in English, etc.).
2. Answer the user's questions accurately, thoroughly, and directly.
3. If asked specifically about the date, time, calendar, or today's day, use the real-time context provided above.
4. For questions about latest news, astronomy (e.g. James Webb telescope, NASA), science, technology, sports, or current events, provide a detailed and up-to-date answer. Do NOT reply with the date or time unless explicitly asked.
5. If the user explicitly asks for a PDF report, research summary, or document in PDF format, invoke the 'generatePdfDocument' tool with structured Persian content (without repeating the title at the top, without raw pipe tables, and without redundant trailing signatures).
6. Format your Telegram responses clearly using clean Markdown (bold, bullet points, numbered lists, monospace code blocks where appropriate).`;

  // Start Cascading Fallback Loop across Tiers
  let lastError: Error | null = null;
  const attemptedTiers: number[] = [];

  for (let tierAttempt = 0; tierAttempt < TIER_CONFIGS.length; tierAttempt++) {
    const available = rateLimiter.getAvailableTier();
    let currentTierIndex = available ? available.tierIndex : tierAttempt;

    // Avoid infinite loop on same failed tier if error occurred
    if (attemptedTiers.includes(currentTierIndex)) {
      const nextUnattempted = TIER_CONFIGS.findIndex((_, idx) => !attemptedTiers.includes(idx));
      if (nextUnattempted !== -1) {
        currentTierIndex = nextUnattempted;
      } else {
        break;
      }
    }

    attemptedTiers.push(currentTierIndex);
    const tierConfig = TIER_CONFIGS[currentTierIndex];

    try {
      input.onLog?.({
        type: 'gemini_req',
        message: `Attempting generation with Tier ${tierConfig.tier} (${tierConfig.modelId})`,
        model: tierConfig.modelId,
      });

      // Prepare tools configuration (PDF generator tool only; NO search grounding to prevent 429 quota exhaustion on free keys)
      const toolsToUse = [{ functionDeclarations: [generatePdfTool] }];

      let response: any;
      try {
        response = await ai.models.generateContent({
          model: tierConfig.modelId,
          contents: fullContents as any,
          config: {
            systemInstruction,
            tools: toolsToUse,
          },
        });
      } catch (callWithToolsErr: any) {
        console.warn(`[GeminiService] Tool-enabled call failed on ${tierConfig.modelId}, trying pure generation:`, callWithToolsErr?.message || callWithToolsErr);
        // Fallback to pure generation (no tools) on the exact same model tier
        try {
          response = await ai.models.generateContent({
            model: tierConfig.modelId,
            contents: fullContents as any,
            config: {
              systemInstruction,
            },
          });
        } catch (pureCallErr: any) {
          throw pureCallErr;
        }
      }

      rateLimiter.recordUsage(currentTierIndex);

      let replyText = response.text || '';
      
      // Fallback: extract text from candidate parts if response.text is empty
      if (!replyText && response.candidates?.[0]?.content?.parts) {
        const textParts = response.candidates[0].content.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join('\n');
        if (textParts) {
          replyText = textParts;
        }
      }

      let generatedPdf: { buffer: Buffer; filename: string } | undefined;

      // Handle function calls if model invoked PDF generation
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          input.onLog?.({
            type: 'tool_call',
            message: `Model executed tool: ${call.name}`,
            model: tierConfig.modelId,
          });

          if (call.name === 'generatePdfDocument') {
            try {
              const args = call.args as { title: string; subtitle?: string; content: string };
              const pdfBuf = await createPdfBuffer({
                title: args.title || 'AI Document',
                subtitle: args.subtitle,
                content: args.content || replyText || 'محتوای گزارش در فایل ضمیمه قرار دارد.',
                dateStr: dateContext.shamsi.formatted,
              });

              const cleanTitle = (args.title || 'document').replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_').substring(0, 30);
              generatedPdf = {
                buffer: pdfBuf,
                filename: `${cleanTitle || 'report'}.pdf`,
              };

              if (!replyText) {
                replyText = `📄 فایل PDF با عنوان **«${args.title || 'گزارش'}»** با موفقیت تولید شد و پیوست گردید.`;
              }
            } catch (pdfToolErr: any) {
              console.error('[GeminiService] PDF creation error:', pdfToolErr);
              input.onLog?.({
                type: 'error',
                message: `خطا در ساخت PDF: ${pdfToolErr?.message || pdfToolErr}`,
              });
              if (!replyText) {
                const args = call.args as any;
                replyText = args?.content || 'متأسفانه در تولید فایل PDF خطایی رخ داد، اما متن گزارش در بالا در دسترس است.';
              }
            }
          }
        }
      }

      // Extract Grounding metadata URLs if present
      const groundingUrls: Array<{ uri: string; title: string }> = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        for (const chunk of chunks as any[]) {
          if (chunk?.web?.uri) {
            groundingUrls.push({
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri,
            });
          }
        }
      }

      if (!replyText && !generatedPdf) {
        replyText = 'متأسفانه پاسخی از مدل دریافت نشد. لطفاً مجدداً امتحان کنید.';
      }

      // Save trimmed message to conversation history
      history.push({
        role: 'user',
        parts: historyUserMessageParts,
      });
      history.push({
        role: 'model',
        parts: [{ text: replyText }],
      });
      userSessions.set(sessionId, history);

      return {
        replyText,
        modelUsed: tierConfig.modelId,
        tierUsed: tierConfig.tier,
        pdfBuffer: generatedPdf?.buffer,
        pdfFilename: generatedPdf?.filename,
        groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined,
      };
    } catch (err: any) {
      lastError = err;
      const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota');

      input.onLog?.({
        type: 'gemini_fallback',
        message: `Tier ${tierConfig.tier} (${tierConfig.modelId}) failed (${err?.message || 'Error'}). Fallback triggered.`,
        model: tierConfig.modelId,
      });

      if (isRateLimit) {
        rateLimiter.handleRateLimitError(currentTierIndex, 60);
      }

      console.warn(`[GeminiService] Error with ${tierConfig.modelId}:`, err?.message || err);
      // Continue loop to next available tier
    }
  }

  throw new Error(`All Gemini model tiers were exhausted. Last error: ${lastError?.message || 'Unknown'}`);
}
