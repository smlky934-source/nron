import {
  Activity,
  Bot,
  CheckCircle2,
  FileCheck,
  Headphones,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Video,
  Youtube,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BotStatusCard } from './components/BotStatusCard';
import { ChatSimulator } from './components/ChatSimulator';
import { LiveLogsCard } from './components/LiveLogsCard';
import { ModelTiersCard } from './components/ModelTiersCard';
import { Navbar } from './components/Navbar';
import { QuickSetupModal } from './components/QuickSetupModal';
import { AppStats, BotStatus } from './types';

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Silent catch for transient polling hiccups during restarts
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Silent catch for transient polling hiccups during restarts
    }
  };

  const handleRefreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchBotStatus(), fetchStats()]);
    setLoading(false);
  };

  const handleResetQuota = async () => {
    try {
      await fetch('/api/rate-limit/reset', { method: 'POST' });
      fetchStats();
    } catch (e) {
      console.error('Error resetting quota:', e);
    }
  };

  useEffect(() => {
    handleRefreshAll();
    const interval = setInterval(() => {
      fetchStats();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans" dir="rtl">
      {/* Top Navigation */}
      <Navbar
        status={status}
        loading={loading}
        onRefresh={handleRefreshAll}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Messages count */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">کل پیام‌ها</span>
              <MessageSquare className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {stats?.totalMessagesProcessed || 0}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">دریافت شده از تلگرام/وب</div>
          </div>

          {/* PDF count */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">فایل‌های PDF</span>
              <FileCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {stats?.totalPdfGenerated || 0}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">تولید شده توسط هوش مصنوعی</div>
          </div>

          {/* Photos count */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">تصاویر تحلیلی</span>
              <ImageIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {stats?.totalPhotosProcessed || 0}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">پردازش OCR و بینایی</div>
          </div>

          {/* Audio count */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">صوت و ویس</span>
              <Headphones className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {stats?.totalAudioProcessed || 0}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">تحلیل صدا و گفتار</div>
          </div>

          {/* Fallbacks count */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">سوییچ سهمیه (Fallback)</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {stats?.totalFallbacksTriggered || 0}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">سوییچ خودکار موفق</div>
          </div>

          {/* Active Sessions */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">گفتگوهای فعال</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {stats?.activeSessionsCount || 0}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">در حافظه رم سرور</div>
          </div>
        </div>

        {/* Telegram Bot & Webhook Card */}
        <BotStatusCard status={status} onRefresh={handleRefreshAll} />

        {/* Gemini Multi-Tier Fallback Quotas Card */}
        <ModelTiersCard
          tiers={stats?.tiers || []}
          onResetQuota={handleResetQuota}
        />

        {/* Two-Column Interactive Layout: Simulator + Live Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChatSimulator onActivity={fetchStats} />
          <LiveLogsCard logs={stats?.recentLogs || []} onLogsCleared={fetchStats} />
        </div>

        {/* YouTube Channel Banner / CTA */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-red-500/30 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <div className="flex flex-col sm:flex-row items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <Youtube className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">کانال یوتیوب AI Golden</h3>
              <p className="text-red-100 text-sm mt-0.5">
                برای آموزش‌های بیشتر ابزار هوش مصنوعی، ما رو در یوتیوب دنبال کنید.
              </p>
            </div>
          </div>
          <a
            href="https://youtube.com/@aigolden"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-red-600 hover:bg-red-50 font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 shrink-0"
          >
            <Youtube className="w-5 h-5 fill-red-600 text-red-600" />
            <span>Subscribe</span>
          </a>
        </div>
      </main>

      {/* Quick Setup Modal */}
      <QuickSetupModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
