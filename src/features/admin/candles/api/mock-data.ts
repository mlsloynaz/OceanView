import type {
  AdminTicker,
  CandleContext,
  CandlesJob,
  CandlesResultResponse,
  CandlesStatusResponse,
  SymbolCandleRow,
} from "../types";

export const MOCK_CATALOG: AdminTicker[] = [
  { symbol: "AAPL", name: "Apple Inc.", isFavorite: true },
  { symbol: "MSFT", name: "Microsoft Corp.", isFavorite: true },
  { symbol: "NVDA", name: "NVIDIA Corp.", isFavorite: true },
  { symbol: "TSLA", name: "Tesla Inc.", isFavorite: false },
  { symbol: "AMD", name: "Advanced Micro Devices", isFavorite: false },
];

const CONTEXT_BY_SYMBOL: Record<string, CandleContext> = {
  AAPL: {
    status: "ready",
    lastBarAt: "2026-06-24T15:45:00-04:00",
    intervals: {
      daily: { count: 120, lastAt: "2026-06-23T16:00:00-04:00" },
      hourly: { count: 48, lastAt: "2026-06-24T15:00:00-04:00" },
      min15: { count: 96, lastAt: "2026-06-24T15:45:00-04:00" },
    },
    error: null,
  },
  MSFT: {
    status: "ready",
    lastBarAt: "2026-06-24T15:45:00-04:00",
    intervals: {
      daily: { count: 120, lastAt: "2026-06-23T16:00:00-04:00" },
      hourly: { count: 48, lastAt: "2026-06-24T15:00:00-04:00" },
      min15: { count: 94, lastAt: "2026-06-24T15:30:00-04:00" },
    },
    error: null,
  },
  NVDA: {
    status: "missing",
    lastBarAt: null,
    intervals: {},
    error: null,
  },
  TSLA: {
    status: "ready",
    lastBarAt: "2026-06-24T15:30:00-04:00",
    intervals: {
      daily: { count: 118, lastAt: "2026-06-23T16:00:00-04:00" },
      hourly: { count: 46, lastAt: "2026-06-24T15:00:00-04:00" },
      min15: { count: 92, lastAt: "2026-06-24T15:30:00-04:00" },
    },
    error: null,
  },
  AMD: {
    status: "error",
    lastBarAt: "2026-06-23T15:45:00-04:00",
    intervals: {
      daily: { count: 120, lastAt: "2026-06-22T16:00:00-04:00" },
    },
    error: "Provider timeout on 15m fetch",
  },
};

const OUTCOME_BY_SYMBOL: Record<string, SymbolCandleRow["outcome"]> = {
  AAPL: "success",
  MSFT: "success",
  NVDA: "skipped",
  TSLA: "success",
  AMD: "failed",
};

const MESSAGE_BY_SYMBOL: Record<string, string | null> = {
  NVDA: "No bars returned for session",
  AMD: "Provider timeout on 15m fetch",
};

function buildSymbolRow(symbol: string): SymbolCandleRow {
  const upper = symbol.toUpperCase();
  const context = CONTEXT_BY_SYMBOL[upper];
  if (!context) {
    return {
      symbol: upper,
      context: {
        status: "missing",
        lastBarAt: null,
        intervals: {},
        error: null,
      },
      outcome: "unknown",
      message: null,
    };
  }
  return {
    symbol: upper,
    context,
    outcome: OUTCOME_BY_SYMBOL[upper] ?? "unknown",
    message: MESSAGE_BY_SYMBOL[upper] ?? null,
  };
}

export function buildMockResult(tickers: string[]): CandlesResultResponse {
  const symbols = tickers.map(buildSymbolRow);
  const succeeded = symbols.filter((s) => s.outcome === "success").length;
  const failed = symbols.filter((s) => s.outcome === "failed").length;
  const skipped = symbols.filter((s) => s.outcome === "skipped").length;

  const job: CandlesJob = {
    jobId: "candles-mock-001",
    kind: "refresh",
    status: "completed",
    startedAt: "2026-06-24T09:15:00Z",
    finishedAt: "2026-06-24T09:18:22Z",
    summary: {
      total: symbols.length,
      succeeded,
      failed,
      skipped,
    },
  };

  let bannerKind: CandlesResultResponse["banner"]["kind"] = "ok";
  let body = `Last run completed for ${succeeded} ticker(s).`;

  if (failed > 0 && succeeded > 0) {
    bannerKind = "warn";
    body = `${succeeded} succeeded, ${failed} failed, ${skipped} skipped.`;
  } else if (failed > 0) {
    bannerKind = "error";
    body = `${failed} ticker(s) failed on last run.`;
  } else if (symbols.length === 0) {
    bannerKind = "none";
    body = "No tickers in catalog.";
  }

  return {
    job,
    banner: {
      kind: bannerKind,
      title: "Candle intake",
      body,
    },
    symbols,
  };
}

let mockJobRunning = false;
let mockJobKind: CandlesJob["kind"] = "refresh";

export function markMockJobStarted(kind: CandlesJob["kind"]) {
  mockJobRunning = true;
  mockJobKind = kind;
}

export function buildMockStatus(tickers: string[]): CandlesStatusResponse {
  const symbols = tickers.map(buildSymbolRow);

  if (mockJobRunning) {
    return {
      job: {
        jobId: "candles-mock-002",
        kind: mockJobKind,
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        progress: { completed: 1, total: Math.max(tickers.length, 1) },
      },
      symbols,
    };
  }

  mockJobRunning = false;

  return {
    job: {
      jobId: "candles-mock-001",
      kind: "refresh",
      status: "idle",
      startedAt: null,
      finishedAt: null,
    },
    symbols: symbols.map((row) =>
      row.context.status === "ready"
        ? row
        : {
            ...row,
            context: {
              ...row.context,
              status: row.context.status === "missing" ? "ready" : row.context.status,
              lastBarAt: row.context.lastBarAt ?? "2026-06-24T15:45:00-04:00",
              intervals:
                Object.keys(row.context.intervals).length > 0
                  ? row.context.intervals
                  : {
                      daily: { count: 120, lastAt: "2026-06-23T16:00:00-04:00" },
                      hourly: { count: 48, lastAt: "2026-06-24T15:00:00-04:00" },
                      min15: { count: 96, lastAt: "2026-06-24T15:45:00-04:00" },
                    },
            },
            outcome: "success",
            message: null,
          },
    ),
  };
}

export function completeMockJob() {
  mockJobRunning = false;
}
