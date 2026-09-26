import {
  ArrowDownToLine,
  Bot,
  Calendar,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  modelUsed?: string;
  tierUsed?: number;
  pdfBase64?: string;
  pdfFilename?: string;
  groundingUrls?: Array<{ uri: string; title: string }>;
  imagePreview?: string;
  timestamp: string;
}

export function ChatSimulator({ onActivity }: { onActivity: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '👋 سلام! من شبیه‌ساز منطق هوش مصنوعی ربات تلگرام هستم. می‌توانید هر سوالی بپرسید، درخواست فایل PDF کنید، تصویر بفرستید، یا تاریخ شمسی/میلادی را امتحان کنید.',
      timestamp: new Date().toLocaleTimeString('fa-IR'),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    mimeType: string;
    base64Data: string;
    preview?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const isImg = file.type.startsWith('image/');

      setAttachedFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data: base64,
        preview: isImg ? result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if ((!query.trim() && !attachedFile) || loading) return;

    const userMsgId = Math.random().toString(36).substring(2, 9);
    const newMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: query,
      imagePreview: attachedFile?.preview,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    const currentMedia = attachedFile
      ? {
          mimeType: attachedFile.mimeType,
          base64Data: attachedFile.base64Data,
          fileName: attachedFile.name,
        }
      : undefined;
    setAttachedFile(null);
    setLoading(true);

    try {
      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          media: currentMedia,
          sessionId: 'web-simulator-session',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            sender: 'bot',
            text: data.replyText,
            modelUsed: data.modelUsed,
            tierUsed: data.tierUsed,
            pdfBase64: data.pdfBase64,
            pdfFilename: data.pdfFilename,
            groundingUrls: data.groundingUrls,
            timestamp: new Date().toLocaleTimeString('fa-IR'),
          },
        ]);
        onActivity();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            sender: 'bot',
            text: `⚠️ خطا در دریافت پاسخ: ${data.error || 'Unknown error'}`,
            timestamp: new Date().toLocaleTimeString('fa-IR'),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          sender: 'bot',
          text: `⚠️ خطای شبکه: ${err.message || err}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleResetChat = async () => {
    try {
      await fetch('/api/reset-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'web-simulator-session' }),
      });
      setMessages([
        {
          id: 'welcome-reset',
          sender: 'bot',
          text: '✨ حافظه پاک شد. گفتگوی جدید آغاز شد.',
          timestamp: new Date().toLocaleTimeString('fa-IR'),
        },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const downloadPdf = (base64: string, filename = 'document.pdf') => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const quickPrompts = [
    'امروز چندمه و ساعت دقیق چنده؟',
    'یک تحقیق کوتاه درباره مزایای هوش مصنوعی بنویس و فایل PDF بده',
    'آخرین اخبار مهم فضا و تلسکوپ جیمز وب چیست؟',
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[560px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">شبیه‌ساز چت و تست هوش مصنوعی در پنل</h3>
            <p className="text-[11px] text-slate-500">
              تست مستقیم پایپ‌لاین سهمیه، ابزار تقویم شمسی و تولید PDF
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetChat}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>New Chat (پاکسازی حافظه)</span>
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-indigo-600 text-white shadow-xs'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>

            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none'
                  : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/60'
              }`}
            >
              {/* Image Preview if user attached */}
              {msg.imagePreview && (
                <div className="mb-2 rounded-lg overflow-hidden border border-slate-700 max-w-xs">
                  <img src={msg.imagePreview} alt="User attachment" className="w-full h-auto max-h-48 object-cover" />
                </div>
              )}

              {/* Text Body */}
              <div className="whitespace-pre-line break-words">{msg.text}</div>

              {/* Generated PDF Attachment Card */}
              {msg.pdfBase64 && (
                <div className="mt-2.5 p-2.5 bg-white rounded-xl border border-indigo-200 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-[11px]">
                        {msg.pdfFilename || 'document.pdf'}
                      </div>
                      <div className="text-[10px] text-slate-500">فایل آماده دانلود PDF</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadPdf(msg.pdfBase64!, msg.pdfFilename)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3 h-3" />
                    <span>دانلود</span>
                  </button>
                </div>
              )}

              {/* Grounding Source URLs */}
              {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/70 text-[11px]">
                  <div className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 text-indigo-500" /> منابع گوگل:
                  </div>
                  <div className="space-y-1">
                    {msg.groundingUrls.map((g, i) => (
                      <a
                        key={i}
                        href={g.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline block truncate text-[10px]"
                      >
                        • {g.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Tag Footer */}
              {msg.modelUsed && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                    Tier {msg.tierUsed} ({msg.modelUsed})
                  </span>
                  <span>{msg.timestamp}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-600 border border-slate-200/60 flex items-center gap-2">
              <span className="animate-pulse">در حال بررسی سهمیه مدل و تولید پاسخ...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-slate-600 shrink-0 font-medium">نمونه سوال:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(p)}
            disabled={loading}
            className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-md shrink-0 transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* File Attachment Pill */}
      {attachedFile && (
        <div className="px-4 py-1.5 bg-indigo-50/80 border-t border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
          <span className="flex items-center gap-1.5 truncate max-w-xs">
            <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
            فایل ضمیمه: <strong>{attachedFile.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className="p-1 text-slate-500 hover:text-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,application/pdf,text/*"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="ضمیمه عکس یا فایل PDF"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="پیام یا درخواست خود را بنویسید (مثلاً: در مورد فلان موضوع فایل PDF بده)..."
            disabled={loading}
            className="flex-1 bg-slate-100 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !attachedFile) || loading}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
