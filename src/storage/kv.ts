import type {
  MarketSnapshot,
  OptionsSnapshotPayload,
  RecommendationsPayload,
  RefreshStatus,
  StrategyConfig
} from "../types/market";
import type { Env } from "../types/env";
import { DEFAULT_CONFIG } from "../types/env";

export const KV_KEYS = {
  market: "eth:put:latest_market",
  recommendations: "eth:put:latest_recommendations",
  options: "eth:put:latest_options",
  status: "eth:put:last_refresh_status",
  config: "eth:put:config"
} as const;

async function readJson<T>(env: Env, key: string): Promise<T | null> {
  return env.OPTION_PUT_CACHE.get<T>(key, "json");
}

async function writeJson<T>(env: Env, key: string, value: T): Promise<void> {
  await env.OPTION_PUT_CACHE.put(key, JSON.stringify(value));
}

export function getConfig(env: Env): Promise<StrategyConfig | null> {
  return readJson<StrategyConfig>(env, KV_KEYS.config);
}

export async function getConfigOrDefault(env: Env): Promise<StrategyConfig> {
  const config = await getConfig(env);
  return {
    ...DEFAULT_CONFIG,
    ...config
  };
}

export function saveConfig(env: Env, config: StrategyConfig): Promise<void> {
  return writeJson(env, KV_KEYS.config, config);
}

export function getLatestMarket(env: Env): Promise<MarketSnapshot | null> {
  return readJson<MarketSnapshot>(env, KV_KEYS.market);
}

export function saveLatestMarket(env: Env, payload: MarketSnapshot): Promise<void> {
  return writeJson(env, KV_KEYS.market, payload);
}

export function getLatestRecommendations(env: Env): Promise<RecommendationsPayload | null> {
  return readJson<RecommendationsPayload>(env, KV_KEYS.recommendations);
}

export function saveLatestRecommendations(
  env: Env,
  payload: RecommendationsPayload
): Promise<void> {
  return writeJson(env, KV_KEYS.recommendations, payload);
}

export function getLatestOptions(env: Env): Promise<OptionsSnapshotPayload | null> {
  return readJson<OptionsSnapshotPayload>(env, KV_KEYS.options);
}

export function saveLatestOptions(env: Env, payload: OptionsSnapshotPayload): Promise<void> {
  return writeJson(env, KV_KEYS.options, payload);
}

export function getRefreshStatus(env: Env): Promise<RefreshStatus | null> {
  return readJson<RefreshStatus>(env, KV_KEYS.status);
}

export function saveRefreshStatus(env: Env, payload: RefreshStatus): Promise<void> {
  return writeJson(env, KV_KEYS.status, payload);
}
