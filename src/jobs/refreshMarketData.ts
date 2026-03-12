import { getDeribitAuthHeaders } from "../providers/deribit";
import { fetchEthOptionChain } from "../providers/options";
import { fetchEthSpotPrice } from "../providers/spot";
import { estimateMarketIv } from "../providers/volatility";
import { saveRefreshStatus, getConfigOrDefault } from "../storage/kv";
import { persistSnapshotBundle } from "../storage/snapshots";
import { buildSnapshotBundle } from "../services/screener";
import { fetchRiskFreeRateWithFallback } from "../services/riskFreeRate";
import type { Env } from "../types/env";
import type { RefreshStatus, SnapshotBundle } from "../types/market";

export async function refreshMarketData(env: Env): Promise<SnapshotBundle> {
  const startedAt = new Date().toISOString();
  const provider = "deribit";

  try {
    // 优化 1：认证与独立数据请求并行
    // 无风险利率和配置不依赖认证，可以立即开始
    const [deribitHeaders, config, riskFreeRate] = await Promise.all([
      getDeribitAuthHeaders(env),
      getConfigOrDefault(env),
      fetchRiskFreeRateWithFallback(0.02)
    ]);

    // 优化 2：使用认证后的 headers 并行获取市场数据
    const [spotPrice, optionChain] = await Promise.all([
      fetchEthSpotPrice(env, deribitHeaders),
      fetchEthOptionChain(env, deribitHeaders)
    ]);

    // 优化 3：获取 optionChain 后立即计算 marketIv（不阻塞其他操作）
    const marketIv = estimateMarketIv(optionChain);

    // 构建快照
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

    // 优化 4：持久化（内部已并行化）
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
