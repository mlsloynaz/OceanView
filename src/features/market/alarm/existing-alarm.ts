/**
 * Alarms that were already met when Movement Watch is turned on.
 * They belong on the alarm list and do not ring.
 */

export type ListedEnter = {
  symbol?: string;
  kind?: string;
  ruleKeys?: string[];
  evidence?: string | null;
  tradeDate?: string;
  triggeredAt?: string;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function alarmAlreadyPassed(input: {
  silenceInitialMet?: boolean;
  met: boolean;
  ruleStatus?: string | null;
  entryAt?: string | null;
  jobStartedAt?: string | null;
}): boolean {
  if (!input.silenceInitialMet || !input.met) return false;
  const status = input.ruleStatus ?? "";
  if (status === "pending" || status === "paused") return false;
  const entryMs = parseTime(input.entryAt);
  const startMs = parseTime(input.jobStartedAt);
  if (entryMs != null && startMs != null) return entryMs < startMs;
  return true;
}

function ruleKeySignature(keys: string[] | undefined): string {
  return [...(keys ?? [])]
    .map((key) => String(key || "").trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

/** Same enter is already on the alarm list — do not add it again. */
export function enterAlreadyListed(
  entries: ListedEnter[],
  input: {
    symbol: string;
    ruleKeys: string[];
    evidence: string | null;
    entryAt: string | null;
  },
): boolean {
  const symbol = input.symbol.trim().toUpperCase();
  const keys = ruleKeySignature(input.ruleKeys);
  const entryDay = input.entryAt?.slice(0, 10) ?? null;
  const evidence = (input.evidence ?? "").trim();
  const entryMs = parseTime(input.entryAt);
  return entries.some((row) => {
    if (row.kind !== "enter") return false;
    if ((row.symbol ?? "").trim().toUpperCase() !== symbol) return false;
    if (ruleKeySignature(row.ruleKeys) !== keys) return false;
    if (entryDay && row.tradeDate && row.tradeDate !== entryDay) return false;
    if (evidence && (row.evidence ?? "").trim() === evidence) return true;
    const listedMs = parseTime(row.triggeredAt);
    if (entryMs != null && listedMs != null && Math.abs(entryMs - listedMs) <= 20 * 60 * 1000) {
      return true;
    }
    return false;
  });
}
