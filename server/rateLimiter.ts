export interface TierConfig {
  tier: number;
  name: string;
  modelId: string;
  rpmLimit: number;
  rpdLimit: number;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 1,
    name: 'Gemini 3.5 Flash Lite (اصلی)',
    modelId: 'gemini-3.5-flash-lite',
    rpmLimit: 15,
    rpdLimit: 1500,
  },
  {
    tier: 2,
    name: 'Gemini 3.1 Flash Lite (پشتیبان)',
    modelId: 'gemini-3.1-flash-lite',
    rpmLimit: 15,
    rpdLimit: 1500,
  },
];

interface TierState {
  config: TierConfig;
  requestTimestamps: number[]; // timestamps within last 60s for RPM
  dailyCount: number;
  lastUsed?: number;
  cooldownUntil?: number; // timestamp until when this tier is cooling down (e.g. after 429)
}

class RateLimiterManager {
  private tiers: TierState[] = [];
  private lastResetDay: number = new Date().getUTCDate();

  constructor() {
    this.tiers = TIER_CONFIGS.map((config) => ({
      config,
      requestTimestamps: [],
      dailyCount: 0,
    }));

    // Auto-check reset every 60 seconds
    setInterval(() => this.checkDailyReset(), 60000);
  }

  private checkDailyReset() {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastResetDay) {
      this.tiers.forEach((t) => {
        t.dailyCount = 0;
        t.requestTimestamps = [];
        t.cooldownUntil = undefined;
      });
      this.lastResetDay = currentDay;
      console.log('[RateLimiter] Daily quota reset completed at UTC midnight');
    }
  }

  public getAvailableTier(): { tierIndex: number; config: TierConfig } | null {
    this.checkDailyReset();
    const now = Date.now();

    for (let i = 0; i < this.tiers.length; i++) {
      const state = this.tiers[i];

      // Check cooldown (e.g. from 429)
      if (state.cooldownUntil && now < state.cooldownUntil) {
        continue;
      }

      // Check daily limit
      if (state.dailyCount >= state.config.rpdLimit) {
        continue;
      }

      // Clean up RPM timestamps older than 60s
      state.requestTimestamps = state.requestTimestamps.filter((ts) => now - ts < 60000);

      // Check RPM limit
      if (state.requestTimestamps.length >= state.config.rpmLimit) {
        continue;
      }

      return { tierIndex: i, config: state.config };
    }

    // If all strictly hit limits, pick the highest tier with smallest wait or lowest capacity tier
    const lastTierIndex = this.tiers.length - 1;
    return { tierIndex: lastTierIndex, config: this.tiers[lastTierIndex].config };
  }

  public recordUsage(tierIndex: number) {
    if (tierIndex >= 0 && tierIndex < this.tiers.length) {
      const state = this.tiers[tierIndex];
      const now = Date.now();
      state.requestTimestamps.push(now);
      state.dailyCount += 1;
      state.lastUsed = now;
    }
  }

  public handleRateLimitError(tierIndex: number, cooldownSeconds = 15) {
    if (tierIndex >= 0 && tierIndex < this.tiers.length) {
      const state = this.tiers[tierIndex];
      state.cooldownUntil = Date.now() + cooldownSeconds * 1000;
      console.warn(`[RateLimiter] Tier ${state.config.tier} (${state.config.modelId}) hit rate limit (429). Cooling down for ${cooldownSeconds}s.`);
    }
  }

  public getTiersStatus() {
    const now = Date.now();
    return this.tiers.map((t) => {
      // Clean up window
      const activeRpm = t.requestTimestamps.filter((ts) => now - ts < 60000).length;
      let status: 'active' | 'standby' | 'rate_limited' | 'error' = 'standby';

      if (t.cooldownUntil && now < t.cooldownUntil) {
        status = 'rate_limited';
      } else if (t.dailyCount >= t.config.rpdLimit) {
        status = 'rate_limited';
      } else if (activeRpm >= t.config.rpmLimit) {
        status = 'rate_limited';
      } else {
        status = 'active';
      }

      return {
        tier: t.config.tier,
        name: t.config.name,
        modelId: t.config.modelId,
        rpmLimit: t.config.rpmLimit,
        rpdLimit: t.config.rpdLimit,
        currentRpm: activeRpm,
        currentRpd: t.dailyCount,
        status,
        lastUsed: t.lastUsed ? new Date(t.lastUsed).toLocaleTimeString() : undefined,
      };
    });
  }

  public resetAllManually() {
    this.tiers.forEach((t) => {
      t.dailyCount = 0;
      t.requestTimestamps = [];
      t.cooldownUntil = undefined;
    });
  }
}

export const rateLimiter = new RateLimiterManager();
