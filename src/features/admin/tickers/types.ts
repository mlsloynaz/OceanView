export type CatalogTicker = {
  symbol: string;
  name: string | null;
  isFavorite: boolean;
  active: boolean;
};

export type CatalogTickersResponse = {
  tickers: CatalogTicker[];
};

export type TickerCatalogFilter = "all" | "active" | "inactive";

export type TickerMovementProfileEntry = {
  symbol: string;
  outcome: string;
  message?: string | null;
  updatedAt?: string | null;
  historyBars?: number | null;
  profile: import("@/features/premarket/types").MovementProfile | null;
};

export type BestFitMetrics = {
  sampleSize?: number | null;
  moveCapPct?: number | null;
  stretchMoveCapPct?: number | null;
  expectedMaePct?: number | null;
  winRate?: number | null;
  atrPct?: number | null;
  suggestedStopPct?: number | null;
  pullbackPct?: number | null;
  reachProb5?: number | null;
  reachProb10?: number | null;
  reachProb12?: number | null;
  timeframe?: string | null;
  historyStart?: string | null;
  historyEnd?: string | null;
};

export type BestFitWatchlistRow = {
  rank: number;
  symbol: string;
  name?: string | null;
  currentlyActive?: boolean;
  score: number;
  tier: string;
  reasons: string[];
  metrics: BestFitMetrics;
};

export type BestFitSkippedRow = {
  symbol: string;
  name?: string | null;
  reason?: string | null;
};

export type BestFitWatchlistResponse = {
  kind?: string;
  resolvedAt: string | null;
  limit: number;
  universeSize: number;
  scoredCount: number;
  skippedCount: number;
  watchlist: BestFitWatchlistRow[];
  skipped: BestFitSkippedRow[];
  activation?: {
    applied?: boolean;
    activated?: string[];
    deactivated?: string[];
    message?: string;
  } | null;
  message?: string | null;
};

export type TradableSideMetrics = {
  contractCount?: number | null;
  liquidRate?: number | null;
  medianSpreadPct?: number | null;
  medianSpreadDollars?: number | null;
  pctSpreadUnder5Pct?: number | null;
  medianVolume?: number | null;
  medianOpenInterest?: number | null;
  medianMark?: number | null;
};

export type TradableWatchlistRow = {
  rank: number;
  symbol: string;
  name?: string | null;
  stockRank?: number | null;
  stockScore?: number | null;
  score: number;
  tier: string;
  reasons: string[];
  call?: { metrics?: TradableSideMetrics; eligible?: boolean; score?: number } | null;
  put?: { metrics?: TradableSideMetrics; eligible?: boolean; score?: number } | null;
  zoneContractCount?: number | null;
  spot?: number | null;
};

export type TradableProgressRow = {
  symbol: string;
  name?: string | null;
  stockRank?: number | null;
  stockScore?: number | null;
  sampleCount: number;
  minSamplesReady: number;
  ready: boolean;
  lastSampleAt?: string | null;
  typicalBidAskDollars?: number | null;
  typicalBidAskPct?: number | null;
  underlyingMoveDollarsForOption12Pct?: number | null;
  underlyingMovePctForOption12Pct?: number | null;
};

export type TradableWatchlistResponse = {
  kind?: string;
  status?: string;
  resolvedAt: string | null;
  collectedAt?: string | null;
  limit: number;
  sourceLimit?: number;
  sourceCount: number;
  minSamplesReady?: number;
  maxSamplesPerRun?: number;
  readyCount?: number;
  scoredCount: number;
  skippedCount: number;
  sourceSymbols?: string[];
  bestFitResolvedAt?: string | null;
  progress?: TradableProgressRow[];
  sampledThisRun?: Array<{
    symbol: string;
    sampleCount?: number;
    ready?: boolean;
    typicalBidAskDollars?: number | null;
    underlyingMoveDollarsForOption12Pct?: number | null;
  }>;
  errors?: Array<{ symbol: string; error?: string }>;
  watchlist: TradableWatchlistRow[];
  skipped: BestFitSkippedRow[];
  activation?: {
    applied?: boolean;
    activated?: string[];
    deactivated?: string[];
    message?: string;
  } | null;
  message?: string | null;
};