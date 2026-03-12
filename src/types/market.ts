import type { OptionSnapshotItem, RecommendationItem } from "./option";

export interface ScoringWeights {
  // 收益权重：权利金收益率的重要性
  yieldWeight: number;
  // IV 权重：高波动率的吸引力
  ivWeight: number;
  // Delta 权重：行权概率的惩罚（负值表示偏好低 Delta）
  deltaWeight: number;
  // 有效买入价权重：如果行权，买入价格的吸引力
  effectivePriceWeight: number;
}

export interface ScoringBaselines {
  // 收益率基准：用于归一化（如 0.03 = 3%）
  yieldBaseline: number;
  // IV 基准：用于归一化（如 0.8 = 80%）
  ivBaseline: number;
  // 有效买入折扣基准：相对现价的折扣（如 0.15 = 15% 折扣）
  effectivePriceDiscountBaseline: number;
}

export interface StrategyConfig {
  minIv: number;
  minDte: number;
  maxDte: number;
  minAbsDelta: number;
  maxAbsDelta: number;
  minPositionYield: number;
  targetTopN: number;
  // 评分配置
  scoringWeights: ScoringWeights;
  scoringBaselines: ScoringBaselines;
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
