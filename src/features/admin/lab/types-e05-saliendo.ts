/** Lab E05 saliendo research — API request/result shapes. */

export type LabE05SaliendoRequest = {
  startDate: string;
  endDate: string;
  symbols?: string[];
  forwardBars?: number;
  includeBreakout?: boolean;
};

export type LabE05BucketStats = {
  eventCount: number;
  outsideBbGrowthPct: number | null;
  reversalBeforeHoldPct: number | null;
  biasPersistence: {
    mean: number | null;
    median: number | null;
    histogram: Record<string, number>;
  };
  byHourEt: { hourEt: string; count: number }[];
};

export type LabE05SaliendoResult = {
  studyId: string;
  eventCount: number;
  definitions?: Record<string, string>;
  overall: LabE05BucketStats;
  breakoutLift: {
    withBreakout: LabE05BucketStats;
    withoutBreakout: LabE05BucketStats;
    breakoutUnknownCount?: number;
  };
  params?: {
    startDate: string;
    endDate: string;
    forwardBars: number;
    includeBreakout: boolean;
    symbolCount: number;
    timezone?: string;
  };
  sampleEvents?: Array<Record<string, unknown>>;
  errors?: Array<{ symbol: string; error: string }>;
  savedTo?: string | null;
  finishedAt?: string;
};
