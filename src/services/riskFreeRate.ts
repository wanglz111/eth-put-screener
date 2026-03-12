/**
 * Service for fetching risk-free rate from US Treasury data
 * Uses Treasury Bills average interest rate as the risk-free rate proxy
 */

interface TreasuryRateResponse {
  data: Array<{
    record_date: string;
    security_desc: string;
    avg_interest_rate_amt: string;
  }>;
}

const TREASURY_API_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates";

/**
 * Fetches the latest Treasury Bills rate from US Treasury Fiscal Data API
 * @returns Risk-free rate as a decimal (e.g., 0.0372 for 3.72%)
 */
export async function fetchRiskFreeRate(): Promise<number> {
  const url = new URL(TREASURY_API_URL);
  url.searchParams.set("filter", "security_desc:eq:Treasury Bills");
  url.searchParams.set("sort", "-record_date");
  url.searchParams.set("page[size]", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Treasury API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as TreasuryRateResponse;
  if (!json.data || json.data.length === 0) {
    throw new Error("No Treasury rate data available");
  }

  const ratePercent = parseFloat(json.data[0].avg_interest_rate_amt);
  if (!Number.isFinite(ratePercent)) {
    throw new Error(`Invalid rate value: ${json.data[0].avg_interest_rate_amt}`);
  }

  // Convert percentage to decimal (e.g., 3.72 -> 0.0372)
  return ratePercent / 100;
}

/**
 * Fetches risk-free rate with fallback to default value
 * @param fallback Default rate to use if API fails (default: 0.02)
 * @returns Risk-free rate as a decimal
 */
export async function fetchRiskFreeRateWithFallback(fallback = 0.02): Promise<number> {
  try {
    return await fetchRiskFreeRate();
  } catch (error) {
    console.error("Failed to fetch risk-free rate, using fallback:", error);
    return fallback;
  }
}
