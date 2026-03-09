import type { StrategyConfig } from "../types/market";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function scoreCandidate(
  positionYield: number,
  iv: number | null,
  absDelta: number,
  config: StrategyConfig
): number {
  const normalizedYield = clamp(positionYield / 0.05, 0, 1);
  const normalizedIv = clamp((iv ?? 0) / 1.5, 0, 1);
  const normalizedAbsDelta = clamp(
    (absDelta - config.minAbsDelta) / (config.maxAbsDelta - config.minAbsDelta || 1),
    0,
    1
  );

  return 0.5 * normalizedYield + 0.3 * normalizedIv - 0.2 * normalizedAbsDelta;
}

