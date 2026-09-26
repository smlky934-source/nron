import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { BotStatus } from '../types';

interface BotStatusCardProps {
  status: BotStatus | null;
  onRefresh: () => void;
}

export function BotStatusCard({ status, onRefresh }: BotStatusCardProps) {
  const [sendingTest, setSendingTest] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasToken = Boolean(status?.isConfigured && status?.botInfo);
  const hasGemini = Boolean(status?.hasGeminiKey);
  const hasAdmin = Boolean(status?.adminIds && status.adminIds.length > 0);
  const registeredWebhookUrl = status?.webhookInfo?.url || '';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSendTestMessage = async () => {
    setSendingTest(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/telegram/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🔔 **تست اتصال ربات:** پیام تستی از سرور اختصاصی شما با موفقیت به تلگرام ارسال شد! سرور آماده دریافت و پاسخ‌دهی به پیام‌ها است.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: `پیام تستی به شناسه ادمین (${data.sentTo}) در تلگرام ارسال شد!`,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: data.error || 'خطا در ارسال پیام تستی',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'خطا در برقراری ارتباط با سرور',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const sampleWebhookTemplate = 'https://api.telegram.org/bot<توکن_ربات_شما>/setWebhook?url=https://<دامنه_سرور_شما>/api/telegram/webhook';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">وضعیت استقلال و اتصال ربات تلگرام</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              محیط ۱۰۰٪ ایزوله و اختصاصی
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            این پنل هیچ دخالتی در ست کردن وب‌هوک ندارد. هر کاربر کلیدهای اختصاصی خود را وارد کرده و وب‌هوک را مستقیماً در مرورگر با تلگرام ست می‌کند.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {hasAdmin && hasToken && (
            <button
              type="button"
              onClick={handleSendTestMessage}
              disabled={sendingTest}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              <span>{sendingTest ? 'در حال ارسال...' : 'ارسال پیام تست به تلگرام'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="بروزرسانی وضعیت"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="whitespace-pre-line leading-relaxed">{actionMessage.text}</div>
        </div>
      )}

      {/* 3 Core Secrets Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Bot Token */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Key className="w-3.5 h-3.5 text-indigo-600" />
              ۱. توکن ربات تلگرام
            </span>
            {hasToken ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                متصل شد ✓
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                در انتظار ورود
              </span>
            )}
          </div>
          {hasToken && status?.botInfo ? (
            <div>
              <div className="text-xs font-bold text-slate-900">{status.botInfo.firstName}</div>
              <a
                href={`https://t.me/${status.botInfo.username}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-0.5 mt-0.5"
              >
                @{status.botInfo.username}
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 leading-relaxed">
              متغیر <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">TELEGRAM_BOT_TOKEN</code> را در منوی تنظیمات (Secrets) وارد کنید.
            </div>
          )}
        </div>

        {/* 2. Gemini API Key */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              ۲. کلید هوش مصنوعی
            </span>
            {hasGemini ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                فعال ✓
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ورود در Secrets
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-600 leading-relaxed">
            {hasGemini ? (
              <span className="text-emerald-700 font-medium">کلید Gemini API اختصاصی در Secrets متصل و آماده است.</span>
            ) : (
              <span>کلید اختصاصی <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">GEMINI_API_KEY</code> را در Secrets اضافه کنید تا از سهمیه خودتان استفاده شود.</span>
            )}
          </div>
        </div>

        {/* 3. Admin ID */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ۳. شناسه ادمین (امنیت)
            </span>
            {hasAdmin ? (
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {status?.adminIds.length} ادمین
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                عمومی
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-600 leading-relaxed">
            {hasAdmin ? (
              <div className="font-mono text-slate-800 text-xs font-semibold">
                ID: {status?.adminIds.join(', ')}
              </div>
            ) : (
              <span>شناسه عددی تلگرام خود را در <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">TELEGRAM_ADMIN_ID</code> وارد کنید.</span>
            )}
          </div>
        </div>
      </div>

      {/* Registered Webhook Status (Read-Only directly from api.telegram.org) */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800">وضعیت فعلی وب‌هوک در سرورهای تلگرام (فقط‌خواندنی):</span>
          </div>
          {registeredWebhookUrl ? (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full self-start sm:self-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              وب‌هوک در تلگرام ثبت شده است
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/80 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
              هیچ وب‌هوکی در تلگرام ثبت نشده است
            </span>
          )}
        </div>

        {registeredWebhookUrl ? (
          <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 break-all" dir="ltr">
            {registeredWebhookUrl}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            هنوز وب‌هوکی برای توکن ربات شما در سرورهای تلگرام ثبت نشده است. طبق راهنمای زیر می‌توانید وب‌هوک را خودتان خارج از اپلیکیشن ست کنید.
          </p>
        )}

        {status?.webhookInfo?.lastErrorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>گزارش خطای تلگرام: {status.webhookInfo.lastErrorMessage}</span>
          </div>
        )}

        {status?.webhookInfo?.pendingUpdateCount !== undefined && status.webhookInfo.pendingUpdateCount > 0 && (
          <div className="text-xs text-amber-700 font-medium">
            تعداد پیام‌های معلق در صف تلگرام: {status.webhookInfo.pendingUpdateCount}
          </div>
        )}
      </div>

      {/* Independent Manual Webhook Guide (Zero Dependency) */}
      <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
          <h3 className="text-xs font-bold text-indigo-950">
            نحوه ست کردن وب‌هوک توسط خودتان (مستقیماً در مرورگر، بدون وابستگی به پنل یا دیگران)
          </h3>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed">
          برای اینکه ربات شما کاملاً مستقل باشد و هیچ تداخلی با کاربران دیگر نداشته باشد، پس از پابلیش برنامه یا دریافت دامنه (مثلاً در Cloud Run یا Render)، لینک زیر را با مقادیر خودتان کامل کرده و در آدرس‌بار مرورگر وارد کنید و اینتر بزنید:
        </p>

        <div className="bg-white p-3 rounded-lg border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <code className="text-[11px] font-mono text-indigo-900 break-all select-all" dir="ltr">
            {sampleWebhookTemplate}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(sampleWebhookTemplate, 'wh_template')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 shrink-0 self-end sm:self-auto cursor-pointer"
          >
            {copiedKey === 'wh_template' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>کپی قالب لینک</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
          <div>
            <span className="font-bold text-slate-800">۱. توکن ربات:</span> همان توکن BotFather (مانند <code>123456:ABC...</code>)
          </div>
          <div>
            <span className="font-bold text-slate-800">۲. مسیر اندپوینت سرور:</span> انتهای آدرس دامنه شما همیشه باید <code>/api/telegram/webhook</code> باشد.
          </div>
        </div>
      </div>
    </div>
  );
}
