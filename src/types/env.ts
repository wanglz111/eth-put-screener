import type { StrategyConfig } from "./market";

export interface AssetFetcher {
  fetch(input: Request | URL | string): Promise<Response>;
}

export interface Env {
  OPTION_PUT_CACHE: KVNamespace;
  ASSETS?: AssetFetcher;
  DERIBIT_API_BASE?: string;
  DERIBIT_CLIENT_ID?: string;
  DERIBIT_CLIENT_SECRET?: string;
  RISK_FREE_RATE?: string;
  UNDERLYING?: string;
  CACHE_IMPORT_TOKEN?: string;
  MANUAL_REFRESH_TOKEN?: string;
}

export interface AppBindings {
  Bindings: Env;
}

export const DEFAULT_CONFIG: StrategyConfig = {
  minIv: 0.6,
  minDte: 30,
  maxDte: 45,
  minAbsDelta: 0.1,
  maxAbsDelta: 0.2,
  minPositionYield: 0.02,
  targetTopN: 3,
  scoringWeights: {
    // 主要目标：赚权利金，所以收益率权重最高
    yieldWeight: 0.45,
    // 高 IV 意味着更高的权利金，但也意味着更高的风险
    ivWeight: 0.25,
    // Delta 权重为负：偏好低 Delta（低行权概率）
    // 在 0.1-0.2 范围内，越接近 0.1 越好
    deltaWeight: -0.15,
    // 如果行权，希望买入价格有吸引力（相对现价有折扣）
    effectivePriceWeight: 0.15
  },
  scoringBaselines: {
    // 3% 收益率作为基准（30-45 DTE 的合理目标）
    yieldBaseline: 0.03,
    // 80% IV 作为基准（ETH 的典型高波动环境）
    ivBaseline: 0.8,
    // 15% 折扣作为基准（如果行权，希望比现价便宜 15%）
    effectivePriceDiscountBaseline: 0.15
  }
};
