import type { Env } from "../types/env";
import { getDeribitBaseUrl } from "./deribit";

interface DeribitIndexPriceResponse {
  result?: {
    index_price?: number;
  };
}

export async function fetchEthSpotPrice(env: Env, headers?: HeadersInit): Promise<number> {
  const url = new URL("/api/v2/public/get_index_price", getDeribitBaseUrl(env));
  url.searchParams.set("index_name", "eth_usd");

  const response = await fetch(url, headers ? { headers } : undefined);
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
