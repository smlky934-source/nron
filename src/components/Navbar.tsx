import { Bot, CheckCircle2, HelpCircle, RefreshCw, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { BotStatus } from '../types';

interface NavbarProps {
  status: BotStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenGuide: () => void;
}

export function Navbar({ status, loading, onRefresh, onOpenGuide }: NavbarProps) {
  const isOnline = Boolean(status?.isConfigured && status?.botInfo?.username);
  const hasWebhook = Boolean(status?.webhookInfo?.url);

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
                Telegram AI Cloud Run Bot
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-500" />
                Gemini Multi-Tier
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              سیستم مدیریت ربات تلگرام و سهمیه‌های هوش مصنوعی در سرور کلودران
            </p>
          </div>
        </div>

        {/* Live Status Badges & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-50 border-slate-200">
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-800 font-semibold">
                  @{status?.botInfo?.username}
                </span>
                {hasWebhook ? (
                  <span className="hidden md:inline-flex items-center text-emerald-700 text-[11px] ml-1">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> وب‌هوک فعال
                  </span>
                ) : (
                  <span className="hidden md:inline-flex items-center text-amber-600 text-[11px] ml-1">
                    بدون وب‌هوک
                  </span>
                )}
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="text-slate-700">در انتظار توکن ربات</span>
              </>
            )}
          </div>

          {/* Quick Guide Button */}
          <button
            type="button"
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">راهنمای اتصال</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            title="بروزرسانی وضعیت"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
