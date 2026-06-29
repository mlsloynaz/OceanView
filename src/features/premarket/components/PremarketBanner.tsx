import { premarketApiBaseUrl, premarketUsesMock } from "../api/premarket-client";

export function PremarketBanner() {
  const usesMock = premarketUsesMock();
  const apiBase = premarketApiBaseUrl();

  if (usesMock) {
    return (
      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        Mock mode (<code className="text-[11px]">VITE_USE_MOCK_PREMARKET=true</code>). Start/stop
        uses fixture data — no Schwab or Dynamo writes.
      </p>
    );
  }

  if (!apiBase) return null;

  return (
    <p className="truncate text-[11px] text-ocean-sand/70" title={apiBase}>
      Live API: {apiBase} · Premarket bars are merged in memory only (Admin candles unchanged).
    </p>
  );
}
