import { Activity, Clock, Cpu, Layers, RefreshCcw, Shield, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelTierInfo } from '../types';

interface ModelTiersCardProps {
  tiers: ModelTierInfo[];
  onResetQuota: () => void;
}

export function ModelTiersCard({ tiers, onResetQuota }: ModelTiersCardProps) {
  const [timeState, setTimeState] = useState<{ shamsi: string; tehranTime: string }>({
    shamsi: '...',
    tehranTime: '...',
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const tehranTimeStr = now.toLocaleTimeString('fa-IR', {
        timeZone: 'Asia/Tehran',
        hour12: false,
      });

      // Simple Persian date formatting for UI display
      const faDateStr = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'full',
      }).format(now);

      setTimeState({
        shamsi: faDateStr,
        tehranTime: tehranTimeStr,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">سلسله‌مراتب سهمیه و فال‌بک چندمدلی Gemini</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            سوییچ خودکار بین مدل‌ها در صورت عبور از RPM (در دقیقه) یا RPD (روزانه) بدون قطعی پاسخ کاربر
          </p>
        </div>

        {/* Live Tehran Clock Widget & Reset Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50/70 border border-indigo-200/60 rounded-lg text-xs text-indigo-900">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-mono font-semibold">{timeState.tehranTime}</span>
            <span className="text-[11px] text-indigo-600 border-r border-indigo-200 pr-1.5 mr-0.5">
              تهران
            </span>
          </div>

          <button
            type="button"
            onClick={onResetQuota}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="ریست کردن شمارنده‌های تستی سهمیه"
          >
            <RefreshCcw className="w-3 h-3" />
            <span>ریست شمارنده‌ها</span>
          </button>
        </div>
      </div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {tiers.map((tier) => {
          const rpmPercentage = Math.min(100, Math.round((tier.currentRpm / tier.rpmLimit) * 100));
          const rpdPercentage = Math.min(100, Math.round((tier.currentRpd / tier.rpdLimit) * 100));
          const isRateLimited = tier.status === 'rate_limited';

          return (
            <div
              key={tier.tier}
              className={`p-4 rounded-xl border transition-all ${
                isRateLimited
                  ? 'bg-amber-50/50 border-amber-300'
                  : tier.tier === 1
                  ? 'bg-gradient-to-b from-indigo-50/40 to-white border-indigo-200 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-mono">
                    {tier.tier}
                  </span>
                  Tier {tier.tier}
                </span>

                {isRateLimited ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    تکمیل سهمیه
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    آماده پردازش
                  </span>
                )}
              </div>

              {/* Model Name */}
              <div className="text-xs font-mono font-semibold text-slate-900 mb-3 truncate" title={tier.modelId}>
                {tier.modelId}
              </div>

              {/* RPM Meter */}
              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between text-slate-600">
                  <span>سقف در دقیقه (RPM):</span>
                  <span className="font-mono font-medium text-slate-900">
                    {tier.currentRpm} / {tier.rpmLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      rpmPercentage > 80 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${rpmPercentage}%` }}
                  />
                </div>
              </div>

              {/* RPD Meter */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>سقف روزانه (RPD):</span>
                  <span className="font-mono font-medium text-slate-900">
                    {tier.currentRpd} / {tier.rpdLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      rpdPercentage > 80 ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${rpdPercentage}%` }}
                  />
                </div>
              </div>

              {/* Last Used */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                <span>آخرین استفاده:</span>
                <span className="font-mono text-slate-700">{tier.lastUsed || 'هنوز فراخوانی نشده'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
