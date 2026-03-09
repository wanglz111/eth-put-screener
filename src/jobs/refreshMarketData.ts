import { getDeribitAuthHeaders } from "../providers/deribit";
import { fetchEthOptionChain } from "../providers/options";
import { fetchEthSpotPrice } from "../providers/spot";
import { estimateMarketIv } from "../providers/volatility";
import { saveRefreshStatus, getConfigOrDefault, saveConfig } from "../storage/kv";
import { persistSnapshotBundle } from "../storage/snapshots";
import { buildSnapshotBundle } from "../services/screener";
import type { Env } from "../types/env";
import type { RefreshStatus, SnapshotBundle } from "../types/market";

function parseRiskFreeRate(env: Env): number {
  const value = Number(env.RISK_FREE_RATE ?? "0.02");
  return Number.isFinite(value) ? value : 0.02;
}

export async function refreshMarketData(env: Env): Promise<SnapshotBundle> {
  const startedAt = new Date().toISOString();
  const provider = "deribit";

  try {
    const deribitHeaders = await getDeribitAuthHeaders(env);
    const [spotPrice, optionChain, config] = await Promise.all([
      fetchEthSpotPrice(env, deribitHeaders),
      fetchEthOptionChain(env, deribitHeaders),
      getConfigOrDefault(env)
    ]);

    const riskFreeRate = parseRiskFreeRate(env);
    const marketIv = estimateMarketIv(optionChain);
    await saveConfig(env, config);
    const bundle = buildSnapshotBundle({
      startedAt,
      provider,
      underlying: env.UNDERLYING ?? "ETH",
      spotPrice,
      optionChain,
      marketIv,
      riskFreeRate,
      config
    });

    await persistSnapshotBundle(env, bundle);
    return bundle;
  } catch (error) {
    const failedAt = new Date().toISOString();
    const status: RefreshStatus = {
      ok: false,
      startedAt,
      finishedAt: failedAt,
      provider,
      message: error instanceof Error ? error.message : "unknown refresh error"
    };

    await saveRefreshStatus(env, status);
    throw error;
  }
}
