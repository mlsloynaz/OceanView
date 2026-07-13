/** Human labels + help for Inside BB 15M setup-scan criteria (matches API `breakdown[].key`). */

export type CriterionHelp = {
  title: string;
  description: string;
};

export const SETUP_SCAN_TIER_HELP =
  "Scores use strategy-specific D+1h / 15m setup checks. " +
  "Inside BB 15M (E05): max 23 — Excellent ≥18 · Strong ≥14 · Moderate ≥10. " +
  "Lateral BB15 + Gap (E04): max 10 — Excellent ≥8 · Strong ≥6 · Moderate ≥5 " +
  "(primary: finish the day lateral on 15m). " +
  "Avoid flags do not subtract points but mark caution when other tiers apply.";

export const CRITERION_HELP: Record<string, CriterionHelp> = {
  dailyCloseVsMa20: {
    title: "Daily close vs MA20",
    description:
      "Daily trend is bullish or bearish and the last daily close is on the correct side of MA20 " +
      "(at or above for bullish, at or below for bearish). Neutral daily trend cannot earn this point.",
  },
  dailyMa20Slope: {
    title: "Daily MA20 / BB mid slope",
    description:
      "Bollinger middle slope on the daily timeframe matches the daily trend direction " +
      "(rising for bullish, falling for bearish).",
  },
  dailyMa2040Align: {
    title: "Daily MA20 / MA40 stack",
    description:
      "Daily moving averages are stacked in a clear trend (bullish: shorter MAs above longer; " +
      "bearish: the opposite). Confirms the day timeframe is not choppy.",
  },
  dailyBbExpand: {
    title: "Daily Bollinger expanding",
    description:
      "Daily Bollinger band width is expanding (volatility opening on the day chart). " +
      "Squeeze or closing daily vol does not count.",
  },
  h1CloseVsMa20: {
    title: "Hourly close vs MA20",
    description:
      "Latest hourly close is on the trend side of MA20, using hourly trend (or daily if hourly is neutral). " +
      "Supports continuation in the bias direction into the open.",
  },
  h1Ma20Slope: {
    title: "Hourly MA20 / BB mid slope",
    description:
      "Hourly Bollinger middle slope aligns with the working trend direction, same idea as daily but on 1h bars.",
  },
  h1BbExpand: {
    title: "Hourly Bollinger expansion",
    description:
      "1h Bollinger width and ATR are expanding versus recent average (volatility disipators opening). " +
      "Highest weight (+3) — key for Inside BB 15M opening moves.",
  },
  h1BbMidTrend: {
    title: "Hourly BB mid trending",
    description:
      "Bollinger middle on 1h is clearly sloping up or down (not flat/unknown). " +
      "Middle band acts as a directional guide for the 15m opening play.",
  },
  atrIncreasing: {
    title: "ATR increasing",
    description:
      "Average True Range on hourly bars is at or above its recent average (ratio ≥ 1). " +
      "Rising ATR supports real range expansion, not a flat tape.",
  },
  adxAbove20: {
    title: "ADX above 20",
    description:
      "ADX(14) on hourly bars is at least 20 — enough directional strength, not a dead lateral market.",
  },
  adxAbove25: {
    title: "ADX above 25",
    description:
      "Stronger ADX threshold (+1 bonus). ADX ≥ 25 suggests a firmer trend backing the setup.",
  },
  volumeAboveAvg: {
    title: "Volume above average",
    description:
      "Last hourly volume is at or above the average of the prior ~20 hourly bars. " +
      "Participation supports follow-through.",
  },
  premarketGapAligned: {
    title: "Gap aligned with bias",
    description:
      "Overnight gap direction matches setup bias (gap up with CALL bias, gap down with PUT bias). " +
      "Small bonus when premarket move agrees with D/1h direction.",
  },
  m15TrendLateral: {
    title: "15m BB mid lateral",
    description:
      "15m Bollinger middle-band slope is flat (lateral). Primary Tickers SemiFinal screen for " +
      "Lateral BB15 + Gap (E04) — prior session must end with a lateral BB mid, not up/down.",
  },
  m15VolStableOrClosing: {
    title: "15m BB vol stable/closing",
    description:
      "15m Bollinger width is stable or closing (not opening). Matches E04 “sin volatilidad” " +
      "before the next opening gap.",
  },
  m15InsideBb: {
    title: "15m inside Bollinger",
    description:
      "Last 15m close is inside the Bollinger bands at the end of the day — not stretched outside.",
  },
};

export const AVOID_HELP: Record<string, CriterionHelp> = {
  dailyNeutral: {
    title: "Daily trend neutral",
    description:
      "Daily trend is lateral or unknown. Inside BB 15M prefers a clear day timeframe direction.",
  },
  h1ConflictsDaily: {
    title: "Hourly vs daily conflict",
    description:
      "Hourly and daily trends point opposite ways (e.g. daily bullish, hourly bearish). " +
      "Reduces confidence in a clean opening move.",
  },
  adxBelow15: {
    title: "ADX very weak",
    description: "ADX below 15 — market too lateral; expansion and trend cuts are less reliable.",
  },
  atrFalling: {
    title: "ATR falling",
    description:
      "ATR ratio below ~0.95 — volatility contracting. Opening expansion rules may not fire.",
  },
  priceExtendedDailyBb: {
    title: "Extended on daily BB",
    description:
      "Daily close is outside Bollinger bands (stretched). Higher risk of mean reversion instead of an orderly band ride.",
  },
  m15Trending: {
    title: "15m BB mid trending",
    description:
      "15m Bollinger mid slope is up or down — not the lateral EOD BB mid setup E04 wants.",
  },
  m15VolOpening: {
    title: "15m BB vol still opening",
    description:
      "15m Bollinger width is still expanding at the close — E04 prefers a quiet/compressed channel first.",
  },
};

/** Parse `+2 h1BbExpand: evidence…` or `h1BbExpand: evidence…` */
export function criterionKeyFromReason(line: string): string | null {
  const trimmed = line.trim();
  const withPoints = trimmed.match(/^\+?\d+\s+([a-zA-Z0-9_]+):/);
  if (withPoints) return withPoints[1];
  const plain = trimmed.match(/^([a-zA-Z0-9_]+):/);
  return plain ? plain[1] : null;
}

export function helpForCriterion(key: string): CriterionHelp | null {
  return CRITERION_HELP[key] ?? AVOID_HELP[key] ?? null;
}
