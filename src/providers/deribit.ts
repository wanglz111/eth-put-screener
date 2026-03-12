import type { Env } from "../types/env";

interface DeribitAuthResponse {
  result?: {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
}

interface CachedToken {
  token: string;
  tokenType: string;
  expiresAt: number;
}

// 内存缓存，不持久化（安全考虑）
let tokenCache: CachedToken | null = null;

export function getDeribitBaseUrl(env: Env): string {
  return env.DERIBIT_API_BASE ?? "https://www.deribit.com";
}

/**
 * 获取 Deribit 认证 headers，带 token 缓存
 * Token 缓存在内存中，有效期内复用，避免重复认证
 */
export async function getDeribitAuthHeaders(env: Env): Promise<HeadersInit | undefined> {
  if (!env.DERIBIT_CLIENT_ID || !env.DERIBIT_CLIENT_SECRET) {
    return undefined;
  }

  // 检查缓存的 token 是否有效（提前 60 秒过期以避免边界情况）
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return {
      Authorization: `${tokenCache.tokenType} ${tokenCache.token}`
    };
  }

  // Token 过期或不存在，重新认证
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
  const expiresIn = payload.result?.expires_in ?? 900; // 默认 15 分钟

  if (!accessToken) {
    throw new Error("Deribit auth response did not include an access token");
  }

  // 缓存 token
  tokenCache = {
    token: accessToken,
    tokenType,
    expiresAt: now + expiresIn * 1000
  };

  return {
    Authorization: `${tokenType} ${accessToken}`
  };
}

/**
 * 清除缓存的 token（用于测试或强制重新认证）
 */
export function clearTokenCache(): void {
  tokenCache = null;
}
