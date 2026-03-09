import type { Env } from "../types/env";
import type { OptionContract } from "../types/option";

interface DeribitBookSummaryItem {
  instrument_name?: string;
  mark_price?: number;
  mark_iv?: number;
  underlying_price?: number;
}

interface DeribitBookSummaryResponse {
  result?: DeribitBookSummaryItem[];
}

function getBaseUrl(env: Env): string {
  return env.DERIBIT_API_BASE ?? "https://www.deribit.com";
}

function parseDeribitDate(value: string): Date {
  const match = value.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) {
    throw new Error(`Unsupported Deribit expiry format: ${value}`);
  }

  const [, dayText, monthText, yearText] = match;
  const months: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11
  };

  const month = months[monthText];
  if (month === undefined) {
    throw new Error(`Unsupported Deribit month: ${monthText}`);
  }

  const year = 2000 + Number(yearText);
  const day = Number(dayText);
  return new Date(Date.UTC(year, month, day, 8, 0, 0));
}

function calculateDte(expiryDate: Date, now: Date): number {
  const milliseconds = expiryDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(milliseconds / (1000 * 60 * 60 * 24)));
}

function parseInstrument(
  item: DeribitBookSummaryItem,
  now: Date
): OptionContract | null {
  if (!item.instrument_name) {
    return null;
  }

  const parts = item.instrument_name.split("-");
  if (parts.length !== 4) {
    return null;
  }

  const [, expiryText, strikeText, typeText] = parts;
  const optionType = typeText === "P" ? "put" : typeText === "C" ? "call" : null;
  if (!optionType) {
    return null;
  }

  const expiryDate = parseDeribitDate(expiryText);
  const strike = Number(strikeText);
  const underlyingPrice = item.underlying_price ?? 0;
  const markPrice = item.mark_price ?? 0;

  if (!strike || !underlyingPrice || markPrice <= 0) {
    return null;
  }

  return {
    instrumentName: item.instrument_name,
    optionType,
    expiry: expiryDate.toISOString().slice(0, 10),
    strike,
    dte: calculateDte(expiryDate, now),
    premiumUsd: markPrice * underlyingPrice,
    markPrice,
    iv: typeof item.mark_iv === "number" ? item.mark_iv / 100 : null,
    underlyingPrice,
    source: "deribit"
  };
}

export async function fetchEthOptionChain(env: Env): Promise<OptionContract[]> {
  const url = new URL("/api/v2/public/get_book_summary_by_currency", getBaseUrl(env));
  url.searchParams.set("currency", "ETH");
  url.searchParams.set("kind", "option");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Option chain request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as DeribitBookSummaryResponse;
  const now = new Date();
  const contracts = (payload.result ?? [])
    .map((item) => parseInstrument(item, now))
    .filter((item): item is OptionContract => item !== null);

  return contracts.filter((contract) => contract.optionType === "put");
}

