import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { useLabConditionGapResearch } from "./hooks/useLabConditionGapResearch";
import type { LabConditionGapLabel } from "./types-condition-gap";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");
const FIELD =
  "w-full rounded-md border border-ocean-mid/50 bg-ocean-deep/40 px-2.5 py-1.5 text-xs text-ocean-foam outline-none focus:border-ocean-teal/60";
const LABEL = "mb-1 block text-[11px] font-medium text-ocean-sand";

function fmtNum(value: unknown, digits = 2): string {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function LabelValue({ row }: { row: LabConditionGapLabel }) {
  const { label, value } = row;

  if (label === "gapSize" && value && typeof value === "object") {
    const v = value as { min?: number | null; max?: number | null; average?: number | null };
    return (
      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-ocean-foam">gapSize</p>
        <dl className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-ocean-sand">Min</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{fmtNum(v.min)}</dd>
          </div>
          <div>
            <dt className="text-ocean-sand">Max</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{fmtNum(v.max)}</dd>
          </div>
          <div>
            <dt className="text-ocean-sand">Avg</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{fmtNum(v.average)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (label === "solidCandle" && value && typeof value === "object") {
    const v = value as { count?: number; pct?: number | null; bodyMinPct?: number };
    return (
      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-ocean-foam">solidCandle</p>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <dt className="text-ocean-sand">Count</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{v.count ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ocean-sand">Pct</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">
              {v.pct == null ? "—" : `${v.pct}%`}
            </dd>
          </div>
        </dl>
        {v.bodyMinPct != null ? (
          <p className="mt-2 text-[10px] text-ocean-sand">Body ≥ {(v.bodyMinPct * 100).toFixed(0)}% of range</p>
        ) : null}
      </div>
    );
  }

  if (label === "pullbackSupport" && value && typeof value === "object") {
    const v = value as {
      outsideDH?: number;
      outsideHOnly?: number;
      outside15mOnly?: number;
    };
    return (
      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-ocean-foam">pullbackSupport</p>
        <dl className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-ocean-sand">D + H</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{v.outsideDH ?? 0}</dd>
          </div>
          <div>
            <dt className="text-ocean-sand">H only</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{v.outsideHOnly ?? 0}</dd>
          </div>
          <div>
            <dt className="text-ocean-sand">15m only</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{v.outside15mOnly ?? 0}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
      <p className="mb-1 text-[11px] text-ocean-sand">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-ocean-foam">
        {typeof value === "number" ? value : String(value ?? "—")}
      </p>
    </div>
  );
}

type Props = {
  onBack: () => void;
};

export function LabConditionGapPane({ onBack }: Props) {
  const ws = useLabConditionGapResearch();

  return (
    <AdminExpandedPane
      id="admin-lab-condition-gap"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← Lab
          </button>
          <span>Condition gap</span>
        </span>
      }
      subtitle="Overnight RTH gap + 9:30 open outside 15m BB — count, pullback, gap size, solid candle, D/H support"
      headerExtra={
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={ws.loading}
          onClick={() => void ws.submit()}
        >
          {ws.loading ? (ws.intake ? "Intake + run…" : "Running…") : "Run study"}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-[11px] text-ocean-sand">
          Calls <code className="text-ocean-foam/80">POST /lab/research/condition-gap/run</code>.
          With <strong className="font-medium text-ocean-foam/90">intake</strong> on, thin or missing
          Dynamo candles are pulled from Schwab first (same path as Admin candles).
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={LABEL}>Ticker</span>
            <input
              className={FIELD}
              value={ws.ticker}
              onChange={(e) => ws.setTicker(e.target.value.toUpperCase())}
              placeholder="SPY"
            />
          </label>
          <label className="block">
            <span className={LABEL}>Start date (ET)</span>
            <input
              type="date"
              className={FIELD}
              value={ws.startDate}
              onChange={(e) => ws.setStartDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={LABEL}>End date (ET)</span>
            <input
              type="date"
              className={FIELD}
              value={ws.endDate}
              onChange={(e) => ws.setEndDate(e.target.value)}
            />
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-xs text-ocean-sand">
            <input
              type="checkbox"
              checked={ws.intake}
              onChange={(e) => ws.setIntake(e.target.checked)}
              className="rounded border-ocean-mid"
            />
            Intake candles (Schwab → Dynamo)
          </label>
        </div>

        {ws.error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
            {ws.error}
          </p>
        ) : null}

        {ws.loadingCached && !ws.result ? (
          <p className="text-xs text-ocean-sand">Loading last saved result…</p>
        ) : null}

        {ws.result ? (
          <div className="space-y-3">
            <p className="text-[11px] text-ocean-sand">
              Study <code className="text-ocean-foam/80">{ws.result.studyId}</code>
              {ws.result.params
                ? ` · ${ws.result.params.ticker} · ${ws.result.params.startDate} → ${ws.result.params.endDate} · ${ws.result.params.temporality}`
                : null}
              {ws.result.params?.min15BarCount != null
                ? ` · ${ws.result.params.min15BarCount}×15m bars`
                : null}
              {ws.result.intake?.outcome
                ? ` · intake ${ws.result.intake.outcome}`
                : null}
              {ws.result.finishedAt ? ` · saved ${ws.result.finishedAt}` : null}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(ws.result.labels ?? []).map((row) => (
                <LabelValue key={row.label} row={row} />
              ))}
            </div>

            {ws.result.definitions ? (
              <div className="rounded-lg border border-ocean-mid/30 bg-ocean-deep/10 px-3 py-2 text-[11px] text-ocean-sand">
                <p className="mb-1 font-medium text-ocean-foam">Definitions</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {Object.entries(ws.result.definitions).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-ocean-foam/90">{k}</span>: {v}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ws.result.sampleEvents?.length ? (
              <div className="rounded-lg border border-ocean-mid/30 bg-ocean-deep/10 px-3 py-2">
                <p className="mb-2 text-[11px] font-medium text-ocean-foam">
                  Sample events ({ws.result.sampleEvents.length}
                  {ws.result.eventCount > ws.result.sampleEvents.length
                    ? ` of ${ws.result.eventCount}`
                    : ""}
                  )
                </p>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-left text-[10px] text-ocean-sand">
                    <thead className="sticky top-0 bg-ocean-deep/80 text-ocean-foam">
                      <tr>
                        <th className="px-1 py-1">Date</th>
                        <th className="px-1 py-1">Dir</th>
                        <th className="px-1 py-1">Gap</th>
                        <th className="px-1 py-1">Pullback</th>
                        <th className="px-1 py-1">Solid</th>
                        <th className="px-1 py-1">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ws.result.sampleEvents.slice(0, 40).map((ev, i) => (
                        <tr key={`${String(ev.tradeDate)}-${i}`} className="border-t border-ocean-mid/20">
                          <td className="px-1 py-0.5 tabular-nums">{String(ev.tradeDate ?? "")}</td>
                          <td className="px-1 py-0.5">{String(ev.gapDirection ?? "")}</td>
                          <td className="px-1 py-0.5 tabular-nums">{fmtNum(ev.gapSize)}</td>
                          <td className="px-1 py-0.5">{ev.pullback ? "yes" : "no"}</td>
                          <td className="px-1 py-0.5">{ev.solidCandle ? "yes" : "no"}</td>
                          <td className="px-1 py-0.5">{String(ev.pullbackSupport ?? "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : !ws.loadingCached ? (
          <p className="text-sm text-ocean-sand">
            No saved result yet. Set ticker + dates and click Run study.
          </p>
        ) : null}
      </div>
    </AdminExpandedPane>
  );
}
