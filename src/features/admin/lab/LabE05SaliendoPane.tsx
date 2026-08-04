import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { useLabE05SaliendoResearch } from "./hooks/useLabE05SaliendoResearch";
import type { LabE05BucketStats } from "./types-e05-saliendo";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");
const FIELD =
  "w-full rounded-md border border-ocean-mid/50 bg-ocean-deep/40 px-2.5 py-1.5 text-xs text-ocean-foam outline-none focus:border-ocean-teal/60";
const LABEL = "mb-1 block text-[11px] font-medium text-ocean-sand";

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function BucketCard({ title, stats }: { title: string; stats: LabE05BucketStats }) {
  const topHours = [...(stats.byHourEt ?? [])].sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-ocean-foam">{title}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-ocean-sand">Events</dt>
          <dd className="font-semibold tabular-nums text-ocean-foam">{stats.eventCount}</dd>
        </div>
        <div>
          <dt className="text-ocean-sand">Outside BB growth</dt>
          <dd className="font-semibold tabular-nums text-ocean-foam">
            {fmtPct(stats.outsideBbGrowthPct)}
          </dd>
        </div>
        <div>
          <dt className="text-ocean-sand">Reversal before hold</dt>
          <dd className="font-semibold tabular-nums text-ocean-foam">
            {fmtPct(stats.reversalBeforeHoldPct)}
          </dd>
        </div>
        <div>
          <dt className="text-ocean-sand">Bias bars (mean / med)</dt>
          <dd className="font-semibold tabular-nums text-ocean-foam">
            {fmtNum(stats.biasPersistence?.mean)} / {fmtNum(stats.biasPersistence?.median, 0)}
          </dd>
        </div>
      </dl>
      {topHours.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-[11px] text-ocean-sand">Top hours ET</p>
          <ul className="flex flex-wrap gap-2">
            {topHours.map((row) => (
              <li
                key={row.hourEt}
                className="rounded border border-ocean-mid/40 px-2 py-0.5 text-[11px] tabular-nums text-ocean-foam"
              >
                {row.hourEt} · {row.count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  onBack: () => void;
};

export function LabE05SaliendoPane({ onBack }: Props) {
  const ws = useLabE05SaliendoResearch();

  return (
    <AdminExpandedPane
      id="admin-lab-e05-saliendo"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← Lab
          </button>
          <span>E05 saliendo research</span>
        </span>
      }
      subtitle="Offline scan of stored 15m candles — open inside + vol + mid bias + saliendo, then forward path + breakout lift"
      headerExtra={
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={ws.loading}
          onClick={() => void ws.submit()}
        >
          {ws.loading ? "Running…" : "Run study"}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-[11px] text-ocean-sand">
          Calls <code className="text-ocean-foam/80">POST /lab/research/e05-saliendo/run</code> and
          overwrites <code className="text-ocean-foam/80">lab-e05-saliendo-latest</code>. Leave
          symbols blank to use the active ticker catalog (capped). Research-only — does not change
          live E05 scoring.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="block sm:col-span-2">
            <span className={LABEL}>Symbols (comma-separated, optional)</span>
            <input
              className={FIELD}
              value={ws.symbolsText}
              onChange={(e) => ws.setSymbolsText(e.target.value)}
              placeholder="NFLX,SPY,QQQ"
            />
          </label>
          <label className="block">
            <span className={LABEL}>Forward bars</span>
            <input
              type="number"
              min={1}
              max={32}
              className={FIELD}
              value={ws.forwardBars}
              onChange={(e) => ws.setForwardBars(Number(e.target.value) || 8)}
            />
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-xs text-ocean-sand">
            <input
              type="checkbox"
              checked={ws.includeBreakout}
              onChange={(e) => ws.setIncludeBreakout(e.target.checked)}
              className="rounded border-ocean-mid"
            />
            Include breakout_quality lift
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
                ? ` · ${ws.result.params.startDate} → ${ws.result.params.endDate} · ${ws.result.params.symbolCount} symbols · forward ${ws.result.params.forwardBars}`
                : null}
              {ws.result.finishedAt ? ` · saved ${ws.result.finishedAt}` : null}
            </p>

            <BucketCard title="Overall" stats={ws.result.overall} />

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <BucketCard
                title="With breakout_quality met"
                stats={ws.result.breakoutLift.withBreakout}
              />
              <BucketCard
                title="Without breakout_quality"
                stats={ws.result.breakoutLift.withoutBreakout}
              />
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

            {ws.result.errors?.length ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                {ws.result.errors.length} symbol error(s) — e.g.{" "}
                {ws.result.errors[0]?.symbol}: {ws.result.errors[0]?.error}
              </p>
            ) : null}
          </div>
        ) : !ws.loadingCached ? (
          <p className="text-sm text-ocean-sand">
            No saved result yet. Set dates and click Run study.
          </p>
        ) : null}
      </div>
    </AdminExpandedPane>
  );
}
