export type Lab1Icon = "bb-breakout-up" | "bb-breakout-down" | "none" | string;

export type Lab1TickerResult = {
  symbol: string;
  hit?: boolean;
  notify?: boolean;
  icon?: Lab1Icon;
  side?: "upper" | "lower" | null;
  direction?: "CALL" | "PUT" | string | null;
  expanding?: boolean | null;
  openInside?: boolean | null;
  touchedBand?: boolean | null;
  midAligned?: boolean | null;
  midSlope?: string | null;
  evidence?: string | null;
  error?: string | null;
  barDatetime?: string | null;
  close?: number | null;
  bb?: {
    upper?: number;
    middle?: number;
    lower?: number;
    position?: string;
  } | null;
};

export type Lab1MonitorResponse = {
  kind?: string;
  monitorId?: string | null;
  status?: string;
  startedAt?: string | null;
  stoppedAt?: string | null;
  polledAt?: string | null;
  pollIntervalSeconds?: number;
  tickers?: string[];
  results?: Lab1TickerResult[];
  hits?: Lab1TickerResult[];
  hitCount?: number;
  message?: string | null;
};

export type Lab1StartStopAck = {
  monitorId?: string | null;
  status?: string;
  message?: string;
  hits?: Lab1TickerResult[];
  results?: Lab1TickerResult[];
};
