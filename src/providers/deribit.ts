import type { Env } from "../types/env";

interface DeribitAuthResponse {
  result?: {
    access_token?: string;
    token_type?: string;
  };
}

export function getDeribitBaseUrl(env: Env): string {
  return env.DERIBIT_API_BASE ?? "https://www.deribit.com";
}

export async function getDeribitAuthHeaders(env: Env): Promise<HeadersInit | undefined> {
  if (!env.DERIBIT_CLIENT_ID || !env.DERIBIT_CLIENT_SECRET) {
    return undefined;
  }

  const url = new URL("/api/v2/public/auth", getDeribitBaseUrl(env));
  url.searchParams.set("grant_type", "client_credentials");
  url.searchParams.set("client_id", env.DERIBIT_CLIENT_ID);
  url.searchParams.set("client_secret", env.DERIBIT_CLIENT_SECRET);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Deribit auth request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as DeribitAuthResponse;
  const accessToken = payload.result?.access_token;
  const tokenType = payload.result?.token_type ?? "bearer";

  if (!accessToken) {
    throw new Error("Deribit auth response did not include an access token");
  }

  return {
    Authorization: `${tokenType} ${accessToken}`
  };
}
