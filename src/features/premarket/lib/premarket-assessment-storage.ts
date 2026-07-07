import {
  formatSimulationTimeEt,
  parseSimulationTimeEt,
  type AssessmentTimeMode,
} from "@/features/market/lib/assessment-time";

export const PREMARKET_ASSESSMENT_STORAGE_KEY = "oceanview.premarket.assessment";

export type StoredPremarketAssessment = {
  mode: AssessmentTimeMode;
  simulationTimeEt?: string;
};

function isAssessmentTimeMode(value: unknown): value is AssessmentTimeMode {
  return value === "now" || value === "et";
}

export function readStoredPremarketAssessment(): StoredPremarketAssessment | null {
  try {
    const raw = localStorage.getItem(PREMARKET_ASSESSMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const mode = (parsed as StoredPremarketAssessment).mode;
    if (!isAssessmentTimeMode(mode)) return null;
    const simulationTimeEt = (parsed as StoredPremarketAssessment).simulationTimeEt;
    return {
      mode,
      ...(typeof simulationTimeEt === "string" && simulationTimeEt.trim()
        ? { simulationTimeEt: simulationTimeEt.trim() }
        : {}),
    };
  } catch {
    return null;
  }
}

export function writeStoredPremarketAssessment(value: StoredPremarketAssessment): void {
  try {
    localStorage.setItem(PREMARKET_ASSESSMENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function storedPremarketAssessmentAt(): Date | null {
  const stored = readStoredPremarketAssessment();
  if (stored?.mode !== "et" || !stored.simulationTimeEt) return null;
  return parseSimulationTimeEt(stored.simulationTimeEt);
}

export function defaultPremarketAssessmentMode(): AssessmentTimeMode {
  return readStoredPremarketAssessment()?.mode ?? "now";
}

export function defaultPremarketAssessmentAt(): Date {
  return storedPremarketAssessmentAt() ?? new Date();
}

export function persistPremarketAssessment(mode: AssessmentTimeMode, at: Date): void {
  writeStoredPremarketAssessment({
    mode,
    ...(mode === "et" ? { simulationTimeEt: formatSimulationTimeEt(at) } : {}),
  });
}
