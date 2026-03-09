import { passesStrategyFilters } from "../strategy/filters";
import { scoreCandidate } from "../strategy/scoring";
import { computePutDelta } from "../strategy/delta";
import type {
  MarketSnapshot,
  OptionsSnapshotPayload,
  RecommendationsPayload,
  RefreshStatus,
  SnapshotBundle,
  StrategyConfig
} from "../types/market";
import type { OptionContract, OptionSnapshotItem, RecommendationItem } from "../types/option";

const FALLBACK_DTE_TOLERANCE_DAYS = 7;

interface ScoredCandidate extends RecommendationItem {
  iv: number;
  absDelta: number;
}

function distanceToTargetWindow(dte: number, minDte: number, maxDte: number): number {
  if (dte < minDte) {
    return minDte - dte;
  }

  if (dte > maxDte) {
    return dte - maxDte;
  }

  return 0;
}

function buildCandidate(
  spotPrice: number,
  riskFreeRate: number,
  contract: OptionContract
): ScoredCandidate | null {
  if (contract.iv === null) {
    return null;
  }

  const delta = computePutDelta(spotPrice, contract.strike, riskFreeRate, contract.iv, contract.dte);
  const absDelta = Math.abs(delta);
  const positionYield = contract.premiumUsd / contract.strike;
  const annualizedYield = positionYield * (365 / Math.max(contract.dte, 1));

  return {
    rank: 0,
    expiry: contract.expiry,
    dte: contract.dte,
    strike: contract.strike,
    premium: Number(contract.premiumUsd.toFixed(2)),
    iv: contract.iv,
    delta: Number(delta.toFixed(4)),
    positionYield: Number(positionYield.toFixed(4)),
    annualizedYield: Number(annualizedYield.toFixed(4)),
    score: 0,
    assignmentProbabilityProxy: Number(absDelta.toFixed(4)),
    instrumentName: contract.instrumentName,
    source: contract.source,
    absDelta
  };
}

export function buildSnapshotBundle(input: {
  startedAt?: string;
  timestamp?: string;
  provider: string;
  underlying: string;
  spotPrice: number;
  optionChain: OptionContract[];
  marketIv: number | null;
  riskFreeRate: number;
  config: StrategyConfig;
}): SnapshotBundle {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const timestamp = input.timestamp ?? new Date().toISOString();

  const enrichedCandidates = input.optionChain
    .map((contract) => buildCandidate(input.spotPrice, input.riskFreeRate, contract))
    .filter((item): item is ScoredCandidate => item !== null)
    .map((item) => ({
      ...item,
      score: Number(scoreCandidate(item.positionYield, item.iv, item.absDelta, input.config).toFixed(4))
    }));

  const strictCandidates = enrichedCandidates
    .filter((item) =>
      passesStrategyFilters(
        {
          iv: item.iv,
          dte: item.dte,
          absDelta: item.absDelta,
          positionYield: item.positionYield
        },
        input.config
      )
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.positionYield - left.positionYield;
    });

  const optionsItems: OptionSnapshotItem[] = enrichedCandidates
    .map((item) => ({
      expiry: item.expiry,
      dte: item.dte,
      strike: item.strike,
      premium: item.premium,
      iv: item.iv,
      delta: item.delta,
      absDelta: Number(item.absDelta.toFixed(4)),
      positionYield: item.positionYield,
      annualizedYield: item.annualizedYield,
      score: item.score,
      assignmentProbabilityProxy: item.assignmentProbabilityProxy,
      instrumentName: item.instrumentName,
      source: item.source,
      passesStrictFilters: passesStrategyFilters(
        {
          iv: item.iv,
          dte: item.dte,
          absDelta: item.absDelta,
          positionYield: item.positionYield
        },
        input.config
      )
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.positionYield - left.positionYield;
    });

  let fallbackMessage = "";
  let workingCandidates = strictCandidates;

  if (workingCandidates.length === 0) {
    const availableDtes = Array.from(new Set(enrichedCandidates.map((candidate) => candidate.dte))).sort(
      (left, right) =>
        distanceToTargetWindow(left, input.config.minDte, input.config.maxDte) -
        distanceToTargetWindow(right, input.config.minDte, input.config.maxDte)
    );

    const fallbackDte = availableDtes[0];
    const fallbackDistance =
      fallbackDte === undefined
        ? Number.POSITIVE_INFINITY
        : distanceToTargetWindow(fallbackDte, input.config.minDte, input.config.maxDte);

    if (fallbackDte !== undefined && fallbackDistance <= FALLBACK_DTE_TOLERANCE_DAYS) {
      workingCandidates = enrichedCandidates
        .filter((item) => {
          if (item.dte !== fallbackDte) {
            return false;
          }

          return (
            item.iv >= input.config.minIv &&
            item.absDelta >= input.config.minAbsDelta &&
            item.absDelta <= input.config.maxAbsDelta &&
            item.positionYield >= input.config.minPositionYield
          );
        })
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          return right.positionYield - left.positionYield;
        });

      if (workingCandidates.length > 0) {
        fallbackMessage = `no contracts in ${input.config.minDte}-${input.config.maxDte} DTE; used nearest available expiry at ${fallbackDte} DTE`;
      }
    }
  }

  const candidates: RecommendationItem[] = workingCandidates
    .slice(0, input.config.targetTopN)
    .map((item, index) => ({
      rank: index + 1,
      expiry: item.expiry,
      dte: item.dte,
      strike: item.strike,
      premium: item.premium,
      iv: item.iv,
      delta: item.delta,
      positionYield: item.positionYield,
      annualizedYield: item.annualizedYield,
      score: item.score,
      assignmentProbabilityProxy: item.assignmentProbabilityProxy,
      instrumentName: item.instrumentName,
      source: item.source
    }));

  const market: MarketSnapshot = {
    underlying: input.underlying,
    spotPrice: Number(input.spotPrice.toFixed(2)),
    marketIv: input.marketIv === null ? null : Number(input.marketIv.toFixed(4)),
    riskFreeRate: input.riskFreeRate,
    source: input.provider,
    capturedAt: timestamp
  };

  const recommendations: RecommendationsPayload = {
    underlying: input.underlying,
    strategy: "cash_secured_put",
    generatedAt: timestamp,
    items: candidates
  };

  const options: OptionsSnapshotPayload = {
    underlying: input.underlying,
    strategy: "cash_secured_put",
    generatedAt: timestamp,
    items: optionsItems
  };

  const status: RefreshStatus = {
    ok: true,
    startedAt,
    finishedAt: timestamp,
    provider: input.provider,
    message:
      candidates.length > 0 && fallbackMessage
        ? `refresh completed with ${candidates.length} recommendations; ${fallbackMessage}`
        : `refresh completed with ${candidates.length} recommendations`
  };

  return {
    market,
    options,
    recommendations,
    status
  };
}
