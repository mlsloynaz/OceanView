import { cn } from "@/shared/lib/cn";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { useLab1Monitor } from "./hooks/useLab1Monitor";
import type { Lab1Icon, Lab1TickerResult } from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_TICKERS = ["SPY", "DIA", "QQQ", "SPX", "NVDA"];

function NotifyIcon({ icon }: { icon?: Lab1Icon | null }) {
  if (icon === "bb-breakout-up") {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
        title="Upper band breakout"
        aria-label="Upper band breakout"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v9.69l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V3.75A.75.75 0 0110 3z"
            clipRule="evenodd"
            transform="rotate(180 10 10)"
          />
        </svg>
      </span>
    );
  }
  if (icon === "bb-breakout-down") {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300"
        title="Lower band breakout"
        aria-label="Lower band breakout"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v9.69l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V3.75A.75.75 0 0110 3z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  return <span className="inline-block h-7 w-7" aria-hidden />;
}

function Gate({ ok, label }: { ok: boolean | null | undefined; label: string }) {
  const tone =
    ok === true
      ? "text-emerald-700 dark:text-emerald-300"
      : ok === false
        ? "text-ocean-sand/70"
        : "text-ocean-sand/40";
  return (
    <span className={cn("text-[10px] uppercase tracking-wide", tone)}>
      {ok === true ? "✓" : ok === false ? "·" : "?"} {label}
    </span>
  );
}

type Props = {
  onBack: () => void;
  /** Button label for `onBack` (default: Lab). */
  backLabel?: string;
};

export function Lab1Pane({ onBack, backLabel = "Lab" }: Props) {
  const { state, loading, error, running, start, stop } = useLab1Monitor(true);
  const results: Lab1TickerResult[] = state?.results?.length
    ? state.results
    : (state?.tickers ?? DEFAULT_TICKERS).map((symbol) => ({ symbol }));
  const hits = state?.hits ?? results.filter((r) => r.hit);
  const pollSec = state?.pollIntervalSeconds ?? 30;

  return (
    <AdminExpandedPane
      id="admin-lab-lab1"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← {backLabel}
          </button>
          <span>Lab1 · ETF Bollinger</span>
        </span>
      }
      subtitle="1m expanding disipador + open inside + band touch + mid aligned — SPY, DIA, QQQ, SPX, NVDA"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || running}
            onClick={() => void start()}
            className={cn(BTN, "border border-ocean-teal/50 bg-ocean-teal/15 text-ocean-foam")}
          >
            {running ? "Running…" : "Start"}
          </button>
          <button
            type="button"
            disabled={loading || !running}
            onClick={() => void stop()}
            className={cn(
              BTN,
              "border border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            )}
          >
            Stop
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-ocean-sand">
        Start watches the ETF set every <strong className="text-ocean-foam">{pollSec}s</strong>. A
        hit requires 1m Bollinger expanding, candle open inside the bands, wick touching the
        expanding disipador, and BB midpoint sloping the same way. Hits show a notification icon
        in the results pane.
      </p>

      {error ? <p className="mb-2 text-xs text-ocean-danger">{error}</p> : null}
      {state?.message ? (
        <p className="mb-2 text-xs text-ocean-teal-dim dark:text-ocean-teal">{state.message}</p>
      ) : null}
      <p className="mb-4 text-[11px] text-ocean-sand/70">
        Status: {state?.status ?? "idle"}
        {state?.polledAt ? ` · polled ${state.polledAt}` : null}
        {running ? ` · polling every ${pollSec}s` : null}
        {hits.length ? ` · ${hits.length} active hit(s)` : null}
      </p>

      {hits.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {hits.map((row) => (
            <div
              key={`hit-${row.symbol}`}
              className="inline-flex items-center gap-2 rounded-lg border border-ocean-teal/40 bg-ocean-teal/10 px-2.5 py-1.5 text-xs text-ocean-foam"
            >
              <NotifyIcon icon={row.icon} />
              <span className="font-semibold">{row.symbol}</span>
              <span className="text-ocean-sand">{row.direction ?? row.side ?? "hit"}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
              <th className="px-2 py-1.5 font-medium">Notify</th>
              <th className="px-2 py-1.5 font-medium">Symbol</th>
              <th className="px-2 py-1.5 font-medium">Hit</th>
              <th className="px-2 py-1.5 font-medium">Gates</th>
              <th className="px-2 py-1.5 font-medium">Dir</th>
              <th className="px-2 py-1.5 font-medium">Close</th>
              <th className="px-2 py-1.5 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.symbol}
                className={cn(
                  "border-b border-ocean-mid/25",
                  row.hit ? "bg-ocean-teal/10" : undefined,
                )}
              >
                <td className="px-2 py-1.5">
                  {row.notify || row.hit ? <NotifyIcon icon={row.icon} /> : null}
                </td>
                <td className="px-2 py-1.5 font-semibold text-ocean-foam">{row.symbol}</td>
                <td className="px-2 py-1.5">
                  {row.hit ? (
                    <span className="text-emerald-700 dark:text-emerald-300">yes</span>
                  ) : (
                    <span className="text-ocean-sand">no</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <Gate ok={row.expanding} label="expand" />
                    <Gate ok={row.openInside} label="open∈" />
                    <Gate ok={row.touchedBand} label="touch" />
                    <Gate ok={row.midAligned} label="mid" />
                  </div>
                </td>
                <td className="px-2 py-1.5 tabular-nums text-ocean-sand">
                  {row.direction ?? "—"}
                </td>
                <td className="px-2 py-1.5 tabular-nums">
                  {row.close != null ? row.close.toFixed(2) : "—"}
                </td>
                <td className="max-w-[28rem] px-2 py-1.5 text-ocean-sand/90">
                  {row.error ? (
                    <span className="text-ocean-danger">{row.error}</span>
                  ) : (
                    row.evidence || "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminExpandedPane>
  );
}
