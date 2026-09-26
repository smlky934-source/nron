export interface ModelTierInfo {
  tier: number;
  name: string;
  modelId: string;
  rpmLimit: number;
  rpdLimit: number;
  currentRpm: number;
  currentRpd: number;
  status: 'active' | 'standby' | 'rate_limited' | 'error';
  lastUsed?: string;
}

export interface BotStatus {
  isConfigured: boolean;
  hasGeminiKey: boolean;
  connectionMode?: 'webhook' | 'idle';
  botInfo: {
    id?: number;
    firstName?: string;
    username?: string;
    canJoinGroups?: boolean;
  } | null;
  webhookInfo: {
    url?: string;
    hasCustomCertificate?: boolean;
    pendingUpdateCount?: number;
    lastErrorDate?: number;
    lastErrorMessage?: string;
    maxConnections?: number;
  } | null;
  adminIds: string[];
  appUrl: string;
  webhookEndpoint: string;
  uptimeSeconds: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'webhook_in' | 'gemini_req' | 'gemini_fallback' | 'tool_call' | 'telegram_out' | 'error' | 'security';
  message: string;
  details?: Record<string, unknown>;
  modelUsed?: string;
  user?: {
    id?: number;
    username?: string;
    firstName?: string;
  };
}

export interface AppStats {
  totalMessagesProcessed: number;
  totalPdfGenerated: number;
  totalPhotosProcessed: number;
  totalAudioProcessed: number;
  totalVideosProcessed?: number;
  totalFallbacksTriggered: number;
  activeSessionsCount: number;
  tiers: ModelTierInfo[];
  recentLogs: LogEntry[];
}
