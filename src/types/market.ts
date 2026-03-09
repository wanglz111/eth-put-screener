import type { OptionSnapshotItem, RecommendationItem } from "./option";

export interface StrategyConfig {
  minIv: number;
  minDte: number;
  maxDte: number;
  minAbsDelta: number;
  maxAbsDelta: number;
  minPositionYield: number;
  targetTopN: number;
}

export interface MarketSnapshot {
  underlying: string;
  spotPrice: number;
  marketIv: number | null;
  riskFreeRate: number;
  source: string;
  capturedAt: string;
}

export interface RecommendationsPayload {
  underlying: string;
  strategy: string;
  generatedAt: string;
  items: RecommendationItem[];
}

export interface OptionsSnapshotPayload {
  underlying: string;
  strategy: string;
  generatedAt: string;
  items: OptionSnapshotItem[];
}

export interface RefreshStatus {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  provider: string;
  message: string;
}

export interface SnapshotBundle {
  market: MarketSnapshot;
  options: OptionsSnapshotPayload;
  recommendations: RecommendationsPayload;
  status: RefreshStatus;
}
