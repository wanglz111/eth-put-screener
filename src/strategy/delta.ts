import { computeD1, normalCdf } from "./blackScholes";

export function computePutDelta(
  spot: number,
  strike: number,
  riskFreeRate: number,
  sigma: number | null,
  dte: number
): number {
  if (!sigma || sigma <= 0 || dte <= 0) {
    if (spot < strike) {
      return -1;
    }

    return 0;
  }

  const yearsToExpiry = dte / 365;
  const d1 = computeD1(spot, strike, riskFreeRate, sigma, yearsToExpiry);
  return normalCdf(d1) - 1;
}

