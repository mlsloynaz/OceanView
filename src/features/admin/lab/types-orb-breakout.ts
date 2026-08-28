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
  finishedAt?: string;
};
