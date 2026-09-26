import type { BestFitColumnHelp } from "./best-fit-column-help";

export type Orb5mMetricHelp = BestFitColumnHelp & {
  id: string;
};

export const BEST_FIT_ORB5M_RANKING_HELP = {
  title: "How the ranking works",
  summary:
    "We replay past mornings. After the 9:30 opening candle, if price breaks that first 5-minute range, that is one entry. Each ticker gets a score from 0 to 100. Higher score = this stock historically followed the breakout better. The table is sorted by that score (ties go A–Z).",
  gate: "A ticker needs at least 5 of those mornings before it can be ranked.",
  pieces: [
    { label: "Follow", points: "up to 28", why: "Biggest piece. Did price keep going our way in the next hour?" },
    { label: "vs 1h", points: "up to 12", why: "When it followed and the 1-hour trend was up or down (not sideways), did it match that trend?" },
    { label: "vs VWAP", points: "up to 12", why: "When it followed and session VWAP existed, was the break on the VWAP side? Compare this % to vs 1h — positive VWAP−1h means VWAP agreed more often." },
    { label: "Earned 20", points: "up to 12", why: "Was the follow big enough — at least 20% of that morning’s opening-range height?" },
    { label: "n (sample)", points: "up to 10", why: "More past entries make the numbers more trustworthy." },
    { label: "How often it signals", points: "up to 10", why: "On days that had an opening range, how often did an entry appear? (in ticker detail)" },
    { label: "SMA10", points: "up to 10", why: "How far price usually stretched from the 5m SMA(10) before turning back. The table shows that distance in dollars so you can mark it on TradingView. Mid-size 0.15%–0.80% of last close scores best." },
    { label: "Next=1h", points: "up to 8", why: "Did the 9:35–9:40 candle break the opening range with a strong body, same way as the 1-hour trend?" },
    { label: "Next+Vol", points: "up to 8", why: "Did that same 9:35 candle break, reach 35% of the opening-range height, and show 5-minute volatility opening?" },
    { label: "Earned 35", points: "up to 8", why: "Same as Earned 20, but a larger follow — 35% of the opening-range height." },
    { label: "Stayed beyond the range", points: "up to 6", why: "After entry, did price stay on the breakout side? (in ticker detail)" },
  ],
  tiers:
    "Tier is only a nickname for the score: excellent 70+, strong 55+, moderate 40+, watch below 40.",
};

export const BEST_FIT_ORB5M_COLUMN_HELP: Orb5mMetricHelp[] = [
  {
    id: "promote",
    column: "Promote",
    meaning:
      "Check the tickers you want turned ON in the catalog, then click Promote selected. Everything else is turned off.",
  },
  {
    id: "rank",
    column: "#",
    meaning: "Place in the list. 1 is the best score.",
  },
  {
    id: "symbol",
    column: "Symbol",
    meaning: "The stock. Click it to see every metric and the score breakdown.",
  },
  {
    id: "score",
    column: "Score",
    meaning:
      "Overall grade from 0 to 100 from past 5-minute opening-range breakouts. Higher is a better historical fit. This is what sorts the list.",
  },
  {
    id: "tier",
    column: "Tier",
    meaning:
      "A short label for the score: excellent (70+), strong (55+), moderate (40+), or watch (below 40).",
  },
  {
    id: "follow",
    column: "Follow",
    meaning:
      "After the morning breakout, how often price kept going our way in the next hour (the next 12 five-minute candles). 48% means it followed on about half of those mornings. This is not “48 points” and not the 9:35 candle.",
  },
  {
    id: "earned20",
    column: "Earned 20",
    meaning:
      "How often a Follow was also big enough: the move reached at least 20% of that morning’s opening-range height (first 5-minute candle high minus low). Only counts if Follow already passed. This is stock movement, not option premium.",
  },
  {
    id: "earned35",
    column: "Earned 35",
    meaning:
      "Same as Earned 20, but a larger move: 35% of that morning’s opening-range height, still in the next hour after entry. Not the same as Next+Vol (that one is only the 9:35 candle).",
  },
  {
    id: "vs1h",
    column: "vs 1h",
    meaning:
      "When the breakout Followed, how often it agreed with the 1-hour trend (CALL with 1h up, PUT with 1h down). Sideways / lateral 1-hour trend is ignored — those mornings do not count for or against. This is not the 9:35 candle — that is Next=1h. Compare with vs VWAP.",
  },
  {
    id: "vsvwap",
    column: "vs VWAP",
    meaning:
      "When the breakout Followed, how often it agreed with session VWAP (CALL close above VWAP, PUT close below). Mornings with no VWAP are ignored. Same job as vs 1h — if this % is higher, VWAP was the better direction match. Code name: withVwapPct. Detail also shows VWAP−1h (positive = VWAP overpasses 1h).",
  },
  {
    id: "next1h",
    column: "Next=1h",
    meaning:
      "How often the 9:35–9:40 candle was a strong break of the 9:30 opening range (solid body, close beyond the range) and that break matched the 1-hour trend. Code name: succeedNextEq1hTrend. About that next candle only, not the later follow hour.",
  },
  {
    id: "nextvol",
    column: "Next+Vol",
    meaning:
      "How often the 9:35–9:40 candle broke the opening range, traveled at least 35% of that range’s height, and 5-minute volatility opened (lively range vs ATR, vs the opening candle, or Bollinger width rising). Code name: succeedNextWithVol.",
  },
  {
    id: "hour",
    column: "Hour",
    meaning:
      "The Eastern clock time when this stock most often gave its first breakout of the day (5-minute slot after 9:35). Example 09:35 means the first break usually happens on that candle.",
  },
  {
    id: "sma10",
    column: "SMA10",
    meaning:
      "How far price usually ran away from the 5-minute 10-bar average before it turned back. The table shows that stretch in dollars (from last close) so you can mark the same distance on TradingView. Also shown as a % of last close — not of the opening range. A mid-size stretch (about 0.15%–0.80% of price) scores best.",
  },
  {
    id: "n",
    column: "n",
    meaning:
      "How many mornings we found a first 5-minute opening-range entry. Need at least 5 to get a score. More is more trustworthy.",
  },
  {
    id: "active",
    column: "Active",
    meaning: "Whether this ticker is currently ON in the catalog. Promote can change this.",
  },
];

/** Extra metrics shown when you click a symbol — same plain words. */
export const BEST_FIT_ORB5M_DETAIL_HELP: Orb5mMetricHelp[] = [
  {
    id: "sample",
    column: "Sample",
    meaning: "Same as n — how many first 5-minute opening-range entries we found.",
  },
  {
    id: "against1h",
    column: "Against 1h trend",
    meaning:
      "The opposite of vs 1h: when it Followed and the 1-hour trend was up or down (not sideways), how often the 5-minute side went against that trend.",
  },
  {
    id: "againstvwap",
    column: "Against VWAP",
    meaning:
      "The opposite of vs VWAP: when it Followed and VWAP existed, how often the break was on the wrong side of VWAP.",
  },
  {
    id: "vwapminus1h",
    column: "VWAP − vs 1h",
    meaning:
      "vs VWAP minus vs 1h, in percentage points. Positive means VWAP agreed more often than the 1-hour trend. Zero is a tie. Negative means 1h was the better direction match.",
  },
  {
    id: "stayed",
    column: "Stayed beyond OR",
    meaning:
      "After entry, how often every close in the next hour stayed on the breakout side of the opening range (above the high for CALL, below the low for PUT).",
  },
  {
    id: "signal",
    column: "Signal rate",
    meaning:
      "On days that had a 5-minute opening range, how often we actually got an entry. High means this ticker often gives a morning ORB; low means the range forms but a clean entry is rare.",
  },
  {
    id: "sma10turn",
    column: "Turned toward SMA(10)",
    meaning: "How often price started coming back toward the 10-bar average within the next hour after entry.",
  },
  {
    id: "sma10median",
    column: "Median SMA(10) snap-back",
    meaning: "Typical stretch from the 10-bar average at the first turn, as dollars and as a % of last close. The table SMA10 column uses the most common stretch.",
  },
  {
    id: "sma10tag",
    column: "Avg path back to SMA(10)",
    meaning: "When price actually tagged the 10-bar average after entry, how far that path was on average.",
  },
  {
    id: "mfe",
    column: "Avg MFE",
    meaning:
      "Average best move our way in the next hour after entry (max favorable excursion), as a percent of price.",
  },
  {
    id: "mae",
    column: "Avg MAE",
    meaning:
      "Average worst move against us in that same hour (max adverse excursion). Lower is usually safer.",
  },
  {
    id: "sides",
    column: "CALL / PUT",
    meaning: "How many of the entries were upside breaks vs downside breaks.",
  },
  {
    id: "history",
    column: "History window",
    meaning: "The date range of 5-minute history used for these numbers (about the last 45 days).",
  },
  {
    id: "sessions",
    column: "Sessions",
    meaning: "How many mornings we scanned, and how many of those had a 5-minute opening range.",
  },
];

export const BEST_FIT_ORB5M_ALL_METRIC_HELP: Orb5mMetricHelp[] = [
  ...BEST_FIT_ORB5M_COLUMN_HELP,
  ...BEST_FIT_ORB5M_DETAIL_HELP,
];

export function orb5mHelpByColumn(): Record<string, Orb5mMetricHelp> {
  const out: Record<string, Orb5mMetricHelp> = {};
  for (const item of BEST_FIT_ORB5M_ALL_METRIC_HELP) {
    out[item.column] = item;
  }
  return out;
}
