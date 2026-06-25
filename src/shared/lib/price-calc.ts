export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calc35(value: number): number {
  return round2(value * 1.35 + 0.02);
}

export function calc10(value: number): number {
  return round2(value * 1.1 + 0.02);
}

export function calcRisk(value: number): number {
  return round2(value * 0.8);
}

export function formatCalcResult(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}
