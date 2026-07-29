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
      "Overall fitness from 0 to 100 based on past movement history. Higher = better fit for our style of trades.",
  },
  {
    column: "Tier",
    meaning:
      "Quick label from the score: excellent, strong, moderate, or watch. Just a shortcut so you don’t read every number.",
  },
  {
    column: "MFE",
    meaning:
      "Max Favorable Excursion — on average, how far price moved in your favor after a breakout (as a %). Bigger can be good, but huge moves can also mean wild stocks.",
  },
  {
    column: "MAE",
    meaning:
      "Max Adverse Excursion — on average, how far price moved against you before recovering (as a %). Lower is usually safer.",
  },
  {
    column: "Win",
    meaning:
      "How often past setups worked out in the sample (as a %). Higher means the pattern paid off more often historically.",
  },
  {
    column: "ATR%",
    meaning:
      "Average True Range as a % of price — how much the stock typically moves day to day. Mid-range is often easier to trade than very quiet or very wild names.",
  },
  {
    column: "Stop",
    meaning:
      "Suggested stop distance from the movement profile (as a %). Rough guide for how far a protective stop might sit.",
  },
  {
    column: "n",
    meaning: "Sample size — how many past setups the stats are based on. More samples = more trustworthy numbers.",
  },
  {
    column: "Active",
    meaning:
      "Whether this ticker is currently ON in the catalog (used for Market Assess). Promote can change this.",
  },
];
