export interface OptionContract {
  instrumentName: string;
  optionType: "put" | "call";
  expiry: string;
  strike: number;
  dte: number;
  premiumUsd: number;
  markPrice: number;
  iv: number | null;
  underlyingPrice: number;
  source: string;
}

export interface RecommendationItem {
  rank: number;
  expiry: string;
  dte: number;
  strike: number;
  premium: number;
  iv: number | null;
  delta: number;
  positionYield: number;
  annualizedYield: number;
  score: number;
  assignmentProbabilityProxy: number;
  instrumentName: string;
  source: string;
}

export interface OptionSnapshotItem {
  expiry: string;
  dte: number;
  strike: number;
  premium: number;
  iv: number | null;
  delta: number;
  absDelta: number;
  positionYield: number;
  annualizedYield: number;
  score: number;
  assignmentProbabilityProxy: number;
  instrumentName: string;
  source: string;
  passesStrictFilters: boolean;
}
