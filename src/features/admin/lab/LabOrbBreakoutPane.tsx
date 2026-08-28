import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { useLabOrbBreakoutResearch } from "./hooks/useLabOrbBreakoutResearch";
import type { LabOrbBreakoutLabel } from "./types-orb-breakout";

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

function LabelValue({ row }: { row: LabOrbBreakoutLabel }) {
  const { label, value } = row;

  if (label === "byDirection" && value && typeof value === "object") {
    const v = value as {
      CALL?: { count?: number; followed?: number };
      PUT?: { count?: number; followed?: number };
    };
    return (
      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-ocean-foam">byDirection</p>
        <dl className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <dt className="text-ocean-sand">CALL</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">
              {v.CALL?.count ?? 0} · followed {v.CALL?.followed ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-ocean-sand">PUT</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">
              {v.PUT?.count ?? 0} · followed {v.PUT?.followed ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  if (
    (label === "avgMfeAtr" || label === "avgMaeAtr") &&
    value &&
    typeof value === "object"
  ) {
    const v = value as { mean?: number | null; median?: number | null };
    return (
      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-ocean-foam">{label}</p>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <dt className="text-ocean-sand">Mean</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{fmtNum(v.mean, 3)}</dd>
          </div>
          <div>
            <dt className="text-ocean-sand">Median</dt>
            <dd className="font-semibold tabular-nums text-ocean-foam">{fmtNum(v.median, 3)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (label === "followedPct" && typeof value === "number") {
    return (
      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-3">
        <p className="mb-1 text-[11px] text-ocean-sand">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-ocean-foam">{value.toFixed(1)}%</p>
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

export function LabOrbBreakoutPane({ onBack }: Props) {
  const ws = useLabOrbBreakoutResearch();
  const symbols = ws.result?.params?.symbols?.join(", ");

  return (
    <AdminExpandedPane
      id="admin-lab-orb-breakout"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← Lab
          </button>
          <span>ORB breakout research</span>
        </span>
      }
      subtitle="Historical Opening Range Breakout — how often entry_ready fired and price followed the CALL/PUT side"
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
          Calls <code className="text-ocean-foam/80">POST /lab/research/orb-breakout/run</code>.
          Default bars from <strong className="font-medium text-ocean-foam/90">Alpaca</strong>{" "}
          (in-memory IEX — not written to Dynamo). Same <code className="text-ocean-foam/80">evaluate_orb</code>{" "}
          gates as the Market Alarm; counts the first <code className="text-ocean-foam/80">entry_ready</code>{" "}
          per session in 09:45–11:30 ET, then measures forward follow-through.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={LABEL}>Ticker</span>
            <input
              className={FIELD}
              value={ws.ticker}
              onChange={(e) => ws.setTicker(e.target.value.toUpperCase())}
              placeholder="TSLA"
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
          <label className="block">
            <span className={LABEL}>Bar source</span>
            <select
              className={FIELD}
              value={ws.barSource}
              onChange={(e) => ws.setBarSource(e.target.value as "alpaca" | "stored")}
            >
              <option value="alpaca">Alpaca (default)</option>
              <option value="stored">Stored (Dynamo / Schwab)</option>
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>Forward bars (15m)</span>
            <input
              type="number"
              min={1}
              max={32}
              className={FIELD}
              value={ws.forwardBars}
              onChange={(e) => ws.setForwardBars(Number(e.target.value) || 8)}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Follow threshold (ATR)</span>
            <input
              type="number"
              min={0.1}
              max={3}
              step={0.1}
              className={FIELD}
              value={ws.followThresholdAtr}
              onChange={(e) => ws.setFollowThresholdAtr(Number(e.target.value) || 0.5)}
            />
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
                ? ` · ${symbols || "—"} · ${ws.result.params.startDate} → ${ws.result.params.endDate} · ${ws.result.params.barSource ?? "alpaca"} · forward ${ws.result.params.forwardBars} · thr ${ws.result.params.followThresholdAtr}×ATR`
                : null}
              {ws.result.finishedAt ? ` · saved ${ws.result.finishedAt}` : null}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(ws.result.labels ?? []).map((row) => (
                <LabelValue key={row.label} row={row} />
              ))}
            </div>

            {ws.result.overall?.byHourEt?.length ? (
              <div className="rounded-lg border border-ocean-mid/30 bg-ocean-deep/10 px-3 py-2">
                <p className="mb-2 text-[11px] font-medium text-ocean-foam">Signals by hour ET</p>
                <ul className="flex flex-wrap gap-2">
                  {[...ws.result.overall.byHourEt]
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
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
                {ws.result.errors.length} symbol error(s) — e.g. {ws.result.errors[0]?.symbol}:{" "}
                {ws.result.errors[0]?.error}
              </p>
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
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-left text-[10px] text-ocean-sand">
                    <thead className="sticky top-0 bg-ocean-deep/80 text-ocean-foam">
                      <tr>
                        <th className="px-1 py-1">Date</th>
                        <th className="px-1 py-1">Time</th>
                        <th className="px-1 py-1">Dir</th>
                        <th className="px-1 py-1">Score</th>
                        <th className="px-1 py-1">MFE×ATR</th>
                        <th className="px-1 py-1">MAE×ATR</th>
                        <th className="px-1 py-1">Followed</th>
                        <th className="px-1 py-1">Beyond OR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ws.result.sampleEvents.slice(0, 40).map((ev, i) => (
                        <tr
                          key={`${String(ev.tradeDate)}-${String(ev.hourEt)}-${i}`}
                          className="border-t border-ocean-mid/20"
                        >
                          <td className="px-1 py-0.5 tabular-nums">{String(ev.tradeDate ?? "")}</td>
                          <td className="px-1 py-0.5 tabular-nums">{String(ev.hourEt ?? "")}</td>
                          <td className="px-1 py-0.5">{String(ev.direction ?? "")}</td>
                          <td className="px-1 py-0.5 tabular-nums">{fmtNum(ev.finalEntryScore, 0)}</td>
                          <td className="px-1 py-0.5 tabular-nums">{fmtNum(ev.mfeAtr, 2)}</td>
                          <td className="px-1 py-0.5 tabular-nums">{fmtNum(ev.maeAtr, 2)}</td>
                          <td className="px-1 py-0.5">{ev.followed ? "yes" : "no"}</td>
                          <td className="px-1 py-0.5">{ev.stayedBeyondOr ? "yes" : "no"}</td>
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
