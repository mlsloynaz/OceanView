/** Lab ORB breakout research — API request/result shapes. */

export type LabOrbBreakoutRequest = {
  ticker?: string;
  symbols?: string[];
  startDate: string;
  endDate: string;
  /** Default alpaca — in-memory IEX; never written to Dynamo. */
  barSource?: "alpaca" | "stored";
  forwardBars?: number;
  followThresholdAtr?: number;
};

export type LabOrbBreakoutLabel = {
  label: string;
  value: unknown;
};

export type LabOrbBreakoutStartAck = {
  runId: string;
  status: "running";
  message?: string;
  request?: LabOrbBreakoutRequest & { symbols?: string[]; maxEvents?: number };
  progress?: { done?: number; total?: number };
  kind?: string;
};

export type LabOrbBreakoutResult = {
  studyId: string;
  conditionKey?: string;
  eventCount: number;
  labels: LabOrbBreakoutLabel[];
  definitions?: Record<string, string>;
  coverage?: {
    sessionsInRange?: number;
    sessionsWithOpeningRange?: number;
    entryReadySessions?: number;
  };
  overall?: {
    eventCount?: number;
    followedPct?: number | null;
    stayedBeyondOrPct?: number | null;
    byHourEt?: Array<{ hourEt: string; count: number }>;
  };
  params?: {
    startDate: string;
    endDate: string;
    barSource?: string;
    forwardBars?: number;
    followThresholdAtr?: number;
    symbols?: string[];
    symbolCount?: number;
    timezone?: string;
  };
  sampleEvents?: Array<Record<string, unknown>>;
  errors?: Array<{ symbol: string; error: string }>;
  savedTo?: string | null;
  startedAt?: string;
  finishedAt?: string;
  /** complete | running | failed — from GET /result */
  status?: "complete" | "running" | "failed" | string;
  runId?: string;
  jobRunId?: string;
  message?: string;
  error?: string;
  code?: string;
  progress?: { done?: number; total?: number };
  request?: Record<string, unknown>;
  kind?: string;
};
