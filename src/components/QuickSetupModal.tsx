import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Layers,
  MessageSquare,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

interface QuickSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSetupModal({ isOpen, onClose }: QuickSetupModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const webhookTemplate = 'https://api.telegram.org/bot<توکن_ربات_شما>/setWebhook?url=https://<دامنه_شما>/api/telegram/webhook';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">راهنمای راه‌اندازی مستقل بعد از Remix</h2>
              <p className="text-xs text-slate-500">تنظیم کلیدهای اختصاصی و فعال‌سازی ربات بدون وابستگی</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {/* Step 1: Bot Token */}
          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                  ۱
                </span>
                توکن ربات تلگرام (TELEGRAM_BOT_TOKEN)
              </span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1"
              >
                ربات @BotFather <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-600">
              در تلگرام وارد <code>@BotFather</code> شوید، ربات خود را بسازید و توکن آن را کپی کرده و در بخش <strong>Settings &gt; Secrets</strong> با نام <code>TELEGRAM_BOT_TOKEN</code> ذخیره کنید.
            </p>
            <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-indigo-200 font-mono text-[11px] text-slate-800">
              <span>TELEGRAM_BOT_TOKEN</span>
              <button
                type="button"
                onClick={() => copyToClipboard('TELEGRAM_BOT_TOKEN', 'token')}
                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copiedKey === 'token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>کپی نام متغیر</span>
              </button>
            </div>
          </div>

          {/* Step 2: Gemini API Key */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">
                  ۲
                </span>
                کلید هوش مصنوعی اختصاصی (GEMINI_API_KEY)
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1"
              >
                دریافت API Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-600">
              برای اینکه ربات سهمیه مستقل داشته باشد و به کلید سازنده متکی نباشد، کلید رایگان خود را از گوگل دریافت کرده و با نام <code>GEMINI_API_KEY</code> در Secrets ذخیره کنید.
            </p>
            <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-800">
              <span>GEMINI_API_KEY</span>
              <button
                type="button"
                onClick={() => copyToClipboard('GEMINI_API_KEY', 'gemini')}
                className="text-slate-700 hover:text-slate-900 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copiedKey === 'gemini' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>کپی نام متغیر</span>
              </button>
            </div>
          </div>

          {/* Step 3: Admin ID */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">
                  ۳
                </span>
                شناسه عددی ادمین (TELEGRAM_ADMIN_ID)
              </span>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-slate-700 hover:text-slate-900 font-semibold inline-flex items-center gap-1"
              >
                ربات @userinfobot <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-600">
              برای جلوگیری از سوءاستفاده غریبه‌ها از سهمیه شما، آیدی عددی تلگرام خود را از <code>@userinfobot</code> گرفته و در <code>TELEGRAM_ADMIN_ID</code> قرار دهید.
            </p>
            <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-800">
              <span>TELEGRAM_ADMIN_ID</span>
              <button
                type="button"
                onClick={() => copyToClipboard('TELEGRAM_ADMIN_ID', 'admin')}
                className="text-slate-700 hover:text-slate-900 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copiedKey === 'admin' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>کپی نام متغیر</span>
              </button>
            </div>
          </div>

          {/* Step 4: Webhook Setting Outside App */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                  ۴
                </span>
                ست کردن وب‌هوک مستقیماً در مرورگر (خارج از پنل)
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              پس از استقرار سرور اختصاصی خود (در Cloud Run، Render یا هاست شخصی)، کافیست لینک تلگرام زیر را با توکن و دامنه سرور خودتان در آدرس‌بار مرورگر وارد کرده و اینتر بزنید تا پاسخ <code>ok: true</code> را ببینید:
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200 font-mono text-[11px] text-emerald-900">
              <span className="break-all">{webhookTemplate}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(webhookTemplate, 'wh_box')}
                className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 text-[11px] shrink-0 font-sans font-medium cursor-pointer"
              >
                {copiedKey === 'wh_box' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>کپی قالب لینک</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            متوجه شدم و بستن راهنما
          </button>
        </div>
      </div>
    </div>
  );
}
