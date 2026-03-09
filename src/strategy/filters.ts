import type { StrategyConfig } from "../types/market";

export interface CandidateMetrics {
  iv: number | null;
  dte: number;
  absDelta: number;
  positionYield: number;
}

export function passesStrategyFilters(
  metrics: CandidateMetrics,
  config: StrategyConfig
): boolean {
  if (metrics.iv === null || metrics.iv < config.minIv) {
    return false;
  }

  if (metrics.dte < config.minDte || metrics.dte > config.maxDte) {
    return false;
  }

  if (metrics.absDelta < config.minAbsDelta || metrics.absDelta > config.maxAbsDelta) {
    return false;
  }

  if (metrics.positionYield < config.minPositionYield) {
    return false;
  }

  return true;
}

