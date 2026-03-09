import type { OptionContract } from "../types/option";

function distanceToTargetWindow(dte: number, minDte: number, maxDte: number): number {
  if (dte < minDte) {
    return minDte - dte;
  }

  if (dte > maxDte) {
    return dte - maxDte;
  }

  return 0;
}

export function estimateMarketIv(optionChain: OptionContract[]): number | null {
  const strictSample = optionChain
    .filter((contract) => contract.iv !== null && contract.dte >= 30 && contract.dte <= 45)
    .sort((left, right) => Math.abs(left.strike - left.underlyingPrice) - Math.abs(right.strike - right.underlyingPrice))
    .slice(0, 10);

  const sample =
    strictSample.length > 0
      ? strictSample
      : optionChain
          .filter((contract) => contract.iv !== null)
          .sort((left, right) => {
            const dteDistance = distanceToTargetWindow(left.dte, 30, 45) - distanceToTargetWindow(right.dte, 30, 45);
            if (dteDistance !== 0) {
              return dteDistance;
            }

            return Math.abs(left.strike - left.underlyingPrice) - Math.abs(right.strike - right.underlyingPrice);
          })
          .slice(0, 10);

  if (sample.length === 0) {
    return null;
  }

  const sum = sample.reduce((total, contract) => total + (contract.iv ?? 0), 0);
  return sum / sample.length;
}
