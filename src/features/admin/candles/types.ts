export type BannerKind = "ok" | "warn" | "error" | "running" | "none";

export type JobStatus = "idle" | "running" | "completed" | "failed" | "partial";
export type JobKind = "refresh" | "reset";
export type ContextStatus = "ready" | "missing" | "error";
export type SymbolOutcome = "success" | "failed" | "skipped" | "unknown";

export type AdminTicker = {
  symbol: string;
  name: string | null;
  isFavorite: boolean;
};

export type IntervalSnapshot = {
  count: number;
  lastAt: string;
};

export type CandleContext = {
  status: ContextStatus;
  lastBarAt: string | null;
  intervals: {
    daily?: IntervalSnapshot;
    hourly?: IntervalSnapshot;
    min15?: IntervalSnapshot;
  };
  error: string | null;
};

export type SymbolCandleRow = {
  symbol: string;
  context: CandleContext;
  outcome: SymbolOutcome;
  message: string | null;
};

export type CandlesJob = {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  summary?: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  progress?: {
    completed: number;
    total: number;
  };
};

export type CandlesBanner = {
  kind: BannerKind;
  title: string;
  body: string;
};

export type AdminTickersResponse = {
  tickers: AdminTicker[];
};

export type CandlesResultResponse = {
  job: CandlesJob | null;
  banner: CandlesBanner;
  symbols: SymbolCandleRow[];
};

export type CandlesStatusResponse = {
  job: CandlesJob | null;
  symbols: SymbolCandleRow[];
};

export type CandlesJobAckResponse = {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  message: string;
  tickers: string[];
  summary?: CandlesJob["summary"];
};

export type CandlesRequest = {
  tickers: string[];
};
