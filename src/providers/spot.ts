import type { Env } from "../types/env";

interface DeribitIndexPriceResponse {
  result?: {
    index_price?: number;
  };
}

function getBaseUrl(env: Env): string {
  return env.DERIBIT_API_BASE ?? "https://www.deribit.com";
}

export async function fetchEthSpotPrice(env: Env): Promise<number> {
  const url = new URL("/api/v2/public/get_index_price", getBaseUrl(env));
  url.searchParams.set("index_name", "eth_usd");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Spot price request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as DeribitIndexPriceResponse;
  const spotPrice = payload.result?.index_price;

  if (!spotPrice || Number.isNaN(spotPrice)) {
    throw new Error("Spot price response did not include a valid index_price");
  }

  return spotPrice;
}

