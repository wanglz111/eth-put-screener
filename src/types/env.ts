import type { StrategyConfig } from "./market";

export interface AssetFetcher {
  fetch(input: Request | URL | string): Promise<Response>;
}

export interface Env {
  OPTION_PUT_CACHE: KVNamespace;
  ASSETS?: AssetFetcher;
  DERIBIT_API_BASE?: string;
  RISK_FREE_RATE?: string;
  UNDERLYING?: string;
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
  targetTopN: 3
};

