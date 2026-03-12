import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchEthOptionChain } from "../src/providers/options";
import { fetchEthSpotPrice } from "../src/providers/spot";
import { estimateMarketIv } from "../src/providers/volatility";
import { getDeribitAuthHeaders } from "../src/providers/deribit";
import { fetchRiskFreeRateWithFallback } from "../src/services/riskFreeRate";
import { DEFAULT_CONFIG, type Env } from "../src/types/env";
import { buildSnapshotBundle } from "../src/services/screener";

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    value = value.replace(/^['"]/, "").replace(/['"]$/, "");
    env[key] = value;
  }

  return env;
}

async function loadLocalEnv(): Promise<Record<string, string>> {
  try {
    const file = await readFile(resolve(process.cwd(), ".dev.vars"), "utf8");
    return parseDotEnv(file);
  } catch {
    return {};
  }
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const localEnv = await loadLocalEnv();
  for (const [key, value] of Object.entries(localEnv)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  const workerBaseUrl = requireEnv("WORKER_BASE_URL");
  const importToken = process.env.CACHE_IMPORT_TOKEN ?? requireEnv("MANUAL_REFRESH_TOKEN");

  const env: Env = {
    OPTION_PUT_CACHE: undefined as never,
    DERIBIT_API_BASE: process.env.DERIBIT_API_BASE,
    DERIBIT_CLIENT_ID: process.env.DERIBIT_CLIENT_ID,
    DERIBIT_CLIENT_SECRET: process.env.DERIBIT_CLIENT_SECRET,
    UNDERLYING: process.env.UNDERLYING ?? "ETH"
  };

  const provider = "deribit";
  const startedAt = new Date().toISOString();
  const deribitHeaders = await getDeribitAuthHeaders(env);
  const [spotPrice, optionChain, riskFreeRate] = await Promise.all([
    fetchEthSpotPrice(env, deribitHeaders),
    fetchEthOptionChain(env, deribitHeaders),
    fetchRiskFreeRateWithFallback(0.02)
  ]);

  const bundle = buildSnapshotBundle({
    startedAt,
    provider,
    underlying: env.UNDERLYING ?? "ETH",
    spotPrice,
    optionChain,
    marketIv: estimateMarketIv(optionChain),
    riskFreeRate,
    config: DEFAULT_CONFIG
  });

  const response = await fetch(new URL("/api/import-cache", workerBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${importToken}`
    },
    body: JSON.stringify(bundle)
  });

  const payload = await response.text();
  if (!response.ok) {
    throw new Error(`Import failed with status ${response.status}: ${payload}`);
  }

  console.log(payload);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
