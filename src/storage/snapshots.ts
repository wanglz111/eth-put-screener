import {
  saveLatestMarket,
  saveLatestOptions,
  saveLatestRecommendations,
  saveRefreshStatus
} from "./kv";
import type { Env } from "../types/env";
import type { SnapshotBundle } from "../types/market";

export async function persistSnapshotBundle(env: Env, bundle: SnapshotBundle): Promise<void> {
  await Promise.all([
    saveLatestMarket(env, bundle.market),
    saveLatestOptions(env, bundle.options),
    saveLatestRecommendations(env, bundle.recommendations),
    saveRefreshStatus(env, bundle.status)
  ]);
}
