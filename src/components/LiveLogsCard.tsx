import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Radio,
  ScrollText,
  ShieldAlert,
  Trash2,
  Wrench,
} from 'lucide-react';
import React, { useState } from 'react';
import { LogEntry } from '../types';

interface LiveLogsCardProps {
  logs: LogEntry[];
  onLogsCleared?: () => void;
}

export function LiveLogsCard({ logs, onLogsCleared }: LiveLogsCardProps) {
  const [filter, setFilter] = useState<string>('all');
  const [privacyMask, setPrivacyMask] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      if (onLogsCleared) onLogsCleared();
    } catch (err) {
      console.error('Error clearing logs:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const maskUsername = (username?: string) => {
    if (!username) return '';
    if (!privacyMask) return username;
    if (username.length <= 3) return `${username[0]}***`;
    return `${username.slice(0, 2)}***${username.slice(-1)}`;
  };

  const maskId = (id?: number) => {
    if (!id) return '';
    if (!privacyMask) return String(id);
    const idStr = String(id);
    if (idStr.length <= 4) return '****';
    return `${idStr.slice(0, 3)}****${idStr.slice(-2)}`;
  };

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'fallback') return l.type === 'gemini_fallback';
    if (filter === 'tools') return l.type === 'tool_call';
    if (filter === 'security') return l.type === 'security';
    if (filter === 'error') return l.type === 'error';
    return true;
  });

  const getTypeBadge = (type: LogEntry['type']) => {
    switch (type) {
      case 'webhook_in':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowDownLeft className="w-3 h-3" /> وب‌هوک ورودی
          </span>
        );
      case 'gemini_req':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Radio className="w-3 h-3" /> فراخوانی Gemini
          </span>
        );
      case 'gemini_fallback':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <Layers className="w-3 h-3 text-amber-600" /> سوییچ فال‌بک (Fallback)
          </span>
        );
      case 'tool_call':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Wrench className="w-3 h-3" /> اجرای تابع (Tool)
          </span>
        );
      case 'telegram_out':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowUpRight className="w-3 h-3" /> پاسخ تلگرام
          </span>
        );
      case 'security':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3 h-3" /> امنیتی / بلاک
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3" /> خطا
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[560px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <ScrollText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">لاگ زنده و رهگیری سوییچ مدل‌ها</h3>
            <p className="text-[11px] text-slate-500">
              ثبت تمام درخواست‌های ورودی وب‌هوک، اجرای ابزارها و خطاهای سهمیه
            </p>
          </div>
        </div>

        {/* Filter & Action Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('fallback')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'fallback' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              فال‌بک
            </button>
            <button
              type="button"
              onClick={() => setFilter('tools')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'tools' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ابزارها
            </button>
            <button
              type="button"
              onClick={() => setFilter('security')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'security' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              امنیتی
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPrivacyMask(!privacyMask)}
              title="پنهان‌سازی آیدی و یوزرنیم‌های تلگرام"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                privacyMask
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {privacyMask ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{privacyMask ? 'حالت خصوصی فعال' : 'نمایش کامل آیدی'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={isClearing || logs.length === 0}
              title="پاکسازی تمامی لاگ‌های ثبت‌شده در حافظه سرور"
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3 h-3" />
              <span>پاکسازی</span>
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs py-12">
            <ScrollText className="w-8 h-8 text-slate-500 mb-2 stroke-1" />
            <span>هیچ رویدادی در این فیلتر ثبت نشده است.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString('fa-IR');
            return (
              <div key={log.id} className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getTypeBadge(log.type)}
                    {log.modelUsed && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                        {log.modelUsed}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">{timeStr}</span>
                </div>

                <div className="text-slate-800 font-medium leading-relaxed break-words">{log.message}</div>

                {log.user && (
                  <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-2">
                    <span>
                      کاربر: {log.user.firstName || 'کاربر'}{' '}
                      {log.user.username && (
                        <strong className="text-indigo-600">@{maskUsername(log.user.username)}</strong>
                      )}
                    </span>
                    <span className="font-mono text-slate-600">ID: {maskId(log.user.id)}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
