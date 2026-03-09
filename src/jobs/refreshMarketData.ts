import { fetchEthOptionChain } from "../providers/options";
import { fetchEthSpotPrice } from "../providers/spot";
import { estimateMarketIv } from "../providers/volatility";
import {
  getConfigOrDefault,
  saveConfig,
  saveLatestMarket,
  saveLatestOptions,
  saveLatestRecommendations,
  saveRefreshStatus
} from "../storage/kv";
import { passesStrategyFilters } from "../strategy/filters";
import { scoreCandidate } from "../strategy/scoring";
import { computePutDelta } from "../strategy/delta";
import type { Env } from "../types/env";
import type {
  MarketSnapshot,
  OptionsSnapshotPayload,
  RecommendationsPayload,
  RefreshStatus
} from "../types/market";
import type { OptionSnapshotItem, RecommendationItem } from "../types/option";

const FALLBACK_DTE_TOLERANCE_DAYS = 7;

function parseRiskFreeRate(env: Env): number {
  const value = Number(env.RISK_FREE_RATE ?? "0.02");
  return Number.isFinite(value) ? value : 0.02;
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

interface ScoredCandidate extends RecommendationItem {
  iv: number;
  absDelta: number;
}

function buildCandidate(
  spotPrice: number,
  riskFreeRate: number,
  contract: {
    expiry: string;
    dte: number;
    strike: number;
    premiumUsd: number;
    iv: number | null;
    instrumentName: string;
    source: string;
  },
  targetTopN: number
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

export async function refreshMarketData(env: Env): Promise<{
  market: MarketSnapshot;
  options: OptionsSnapshotPayload;
  recommendations: RecommendationsPayload;
  status: RefreshStatus;
}> {
  const startedAt = new Date().toISOString();
  const provider = "deribit";

  try {
    const [spotPrice, optionChain, config] = await Promise.all([
      fetchEthSpotPrice(env),
      fetchEthOptionChain(env),
      getConfigOrDefault(env)
    ]);

    const riskFreeRate = parseRiskFreeRate(env);
    const marketIv = estimateMarketIv(optionChain);

    await saveConfig(env, config);

    const enrichedCandidates = optionChain
      .map((contract) => buildCandidate(spotPrice, riskFreeRate, contract, config.targetTopN))
      .filter((item): item is ScoredCandidate => item !== null)
      .map((item) => ({
        ...item,
        score: Number(scoreCandidate(item.positionYield, item.iv, item.absDelta, config).toFixed(4))
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
          config
        )
      )
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.positionYield - left.positionYield;
      });

    let fallbackMessage = "";
    let workingCandidates = strictCandidates;

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
          config
        )
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.positionYield - left.positionYield;
      });

    if (workingCandidates.length === 0) {
      const availableDtes = Array.from(new Set(enrichedCandidates.map((candidate) => candidate.dte))).sort(
        (left, right) =>
          distanceToTargetWindow(left, config.minDte, config.maxDte) -
          distanceToTargetWindow(right, config.minDte, config.maxDte)
      );

      const fallbackDte = availableDtes[0];
      const fallbackDistance =
        fallbackDte === undefined
          ? Number.POSITIVE_INFINITY
          : distanceToTargetWindow(fallbackDte, config.minDte, config.maxDte);

      if (fallbackDte !== undefined && fallbackDistance <= FALLBACK_DTE_TOLERANCE_DAYS) {
        workingCandidates = enrichedCandidates
          .filter((item) => {
            if (item.dte !== fallbackDte) {
              return false;
            }

            return (
              item.iv >= config.minIv &&
              item.absDelta >= config.minAbsDelta &&
              item.absDelta <= config.maxAbsDelta &&
              item.positionYield >= config.minPositionYield
            );
          })
          .sort((left, right) => {
            if (right.score !== left.score) {
              return right.score - left.score;
            }

            return right.positionYield - left.positionYield;
          });

        if (workingCandidates.length > 0) {
          fallbackMessage = `no contracts in ${config.minDte}-${config.maxDte} DTE; used nearest available expiry at ${fallbackDte} DTE`;
        }
      }
    }

    const candidates: RecommendationItem[] = workingCandidates.slice(0, config.targetTopN).map((item, index) => ({
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

    const timestamp = new Date().toISOString();
    const underlying = env.UNDERLYING ?? "ETH";

    const market: MarketSnapshot = {
      underlying,
      spotPrice: Number(spotPrice.toFixed(2)),
      marketIv: marketIv === null ? null : Number(marketIv.toFixed(4)),
      riskFreeRate,
      source: provider,
      capturedAt: timestamp
    };

    const recommendations: RecommendationsPayload = {
      underlying,
      strategy: "cash_secured_put",
      generatedAt: timestamp,
      items: candidates
    };

    const options: OptionsSnapshotPayload = {
      underlying,
      strategy: "cash_secured_put",
      generatedAt: timestamp,
      items: optionsItems
    };

    const status: RefreshStatus = {
      ok: true,
      startedAt,
      finishedAt: timestamp,
      provider,
      message:
        candidates.length > 0 && fallbackMessage
          ? `refresh completed with ${candidates.length} recommendations; ${fallbackMessage}`
          : `refresh completed with ${candidates.length} recommendations`
    };

    await Promise.all([
      saveLatestMarket(env, market),
      saveLatestOptions(env, options),
      saveLatestRecommendations(env, recommendations),
      saveRefreshStatus(env, status)
    ]);

    return {
      market,
      options,
      recommendations,
      status
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const status: RefreshStatus = {
      ok: false,
      startedAt,
      finishedAt: failedAt,
      provider,
      message: error instanceof Error ? error.message : "unknown refresh error"
    };

    await saveRefreshStatus(env, status);
    throw error;
  }
}
