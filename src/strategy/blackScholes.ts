function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absoluteX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absoluteX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(absoluteX * absoluteX)));

  return sign * y;
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function computeD1(
  spot: number,
  strike: number,
  riskFreeRate: number,
  sigma: number,
  yearsToExpiry: number
): number {
  const numerator =
    Math.log(spot / strike) + (riskFreeRate + (sigma * sigma) / 2) * yearsToExpiry;
  const denominator = sigma * Math.sqrt(yearsToExpiry);
  return numerator / denominator;
}

export function computeD2(d1: number, sigma: number, yearsToExpiry: number): number {
  return d1 - sigma * Math.sqrt(yearsToExpiry);
}

