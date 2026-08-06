/** Plain-language help for Best-fit table columns. */

export type BestFitColumnHelp = {
  column: string;
  meaning: string;
};

export const BEST_FIT_COLUMN_HELP: BestFitColumnHelp[] = [
  {
    column: "Promote",
    meaning: "Check the boxes for tickers you want to turn ON in the catalog. Then click Promote selected.",
  },
  {
    column: "#",
    meaning: "Rank — place in the list. 1 is the best score.",
  },
  {
    column: "Symbol",
    meaning: "The stock ticker (and company name when we have it).",
  },
  {
    column: "Score",
    meaning:
      "Overall fitness from 0 to 100 from past breakout movement (MFE, MAE, win rate, ATR, sample size) — not how often named strategies fired. Higher = better fit for our style. Click a symbol for % and $ detail.",
  },
  {
    column: "Tier",
    meaning:
      "Quick label from the score: excellent, strong, moderate, or watch. Just a shortcut so you don’t read every number.",
  },
  {
    column: "MFE",
    meaning:
      "Max Favorable Excursion — median upside after a breakout. Detail also shows P75/P90. Table shows %; click the symbol for $ (using last close).",
  },
  {
    column: "MAE",
    meaning:
      "Max Adverse Excursion — median drawdown against you. Detail shows P75/P90 for normal vs abnormal adverse zones. Lower is usually safer.",
  },
  {
    column: "Win",
    meaning:
      "How often past breakouts in the sample worked (movement win rate, not strategy hit rate). Click the symbol to see ~wins out of n.",
  },
  {
    column: "ATR%",
    meaning:
      "Average True Range as a % of price — typical day-to-day range. Mid-range is often easier than very quiet or wild names. Detail also shows $.",
  },
  {
    column: "Stop",
    meaning:
      "Suggested stop distance from the movement profile. Table shows %; click the symbol for approximate $.",
  },
  {
    column: "n",
    meaning:
      "Sample size — how many past breakouts the stats are based on. More samples = more trustworthy numbers.",
  },
  {
    column: "Active",
    meaning:
      "Whether this ticker is currently ON in the catalog (used for Market Assess). Promote can change this.",
  },
];
