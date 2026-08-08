/** Lab condition-gap research — API request/result shapes. */

export type LabConditionGapRequest = {
  ticker: string;
  startDate: string;
  endDate: string;
  temporality?: "15m";
  /** Schwab → Dynamo candle pull when missing/thin (default true on API). */
  intake?: boolean;
};

export type LabConditionGapLabel = {
  label: string;
  value: unknown;
};

export type LabConditionGapResult = {
  studyId: string;
  conditionKey: string;
  ticker?: string;
  eventCount: number;
  labels: LabConditionGapLabel[];
  definitions?: Record<string, string>;
  params?: {
    ticker: string;
    startDate: string;
    endDate: string;
    temporality: string;
    intake?: boolean;
    timezone?: string;
    min15BarCount?: number;
  };
  intake?: {
    outcome?: string;
    message?: string | null;
    symbol?: string;
  } | null;
  sampleEvents?: Array<Record<string, unknown>>;
  savedTo?: string | null;
  finishedAt?: string;
};
