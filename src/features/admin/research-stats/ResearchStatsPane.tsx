import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { resolveStrategyTier } from "@/features/premarket/api/dynamic-strategy-client";
import { useResearchStatsPane } from "./hooks/useResearchStatsPane";
import type {
  DirectionRuleCommonality,
  ResearchMovementDirection,
  RuleHourStat,
  StrategyHourStat,
} from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");
const BTN_SECONDARY = cn(
  BTN,
  "border-2 border-ocean-teal bg-ocean-deep text-ocean-foam hover:bg-ocean-teal/10",
);
const FIELD =
  "w-full rounded-md border border-ocean-mid/50 bg-ocean-deep/40 px-2.5 py-1.5 text-xs text-ocean-foam outline-none focus:border-ocean-teal/60";
const LABEL = "mb-1 block text-[11px] font-medium text-ocean-sand";

function groupRulesByHour(rows: RuleHourStat[]) {
  const map = new Map<number, RuleHourStat[]>();
  for (const row of rows) {
    const list = map.get(row.hourEt) ?? [];
    list.push(row);
    map.set(row.hourEt, list);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function CommonalityBlock({ block }: { block: DirectionRuleCommonality }) {
  const label = block.direction === "up" ? "UP" : "DOWN";
  const color = block.direction === "up" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2">
      <p className={cn("mb-2 text-xs font-semibold", color)}>
        {label} movements ({block.movementsTotal})
      </p>
      {!block.rules.length ? (
        <p className="text-[11px] text-ocean-sand">No matching rules.</p>
      ) : (
        <ul className="space-y-1">
          {block.rules.map((row) => (
            <li
              key={`${block.direction}-${row.ruleKey}`}
              className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
            >
              <code className="text-ocean-foam/90">{row.ruleKey}</code>
              <span className="tabular-nums text-ocean-sand">
                {row.movementsWithRule}/{block.movementsTotal}{" "}
                <span className="text-ocean-teal">({row.sharePct}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  onBack?: () => void;
  /** Button label when `onBack` is set (default: Lab). */
  backLabel?: string;
};

export function ResearchStatsPane({ onBack, backLabel = "Lab" }: Props) {
  const ws = useResearchStatsPane();

  return (
    <AdminExpandedPane
      id={onBack ? "admin-lab-research" : "admin-research-stats-pane"}
      title={
        onBack ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
            >
              ← {backLabel}
            </button>
            <span>Research-Stats</span>
          </span>
        ) : (
          "Research-Stats"
        )
      }
      subtitle="Named research: strategy OR rules · same ticker & timeframe · result overwrites prior save"
      headerExtra={
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={ws.loading || ws.catalogLoading}
          onClick={() => void ws.submit()}
        >
          {ws.loading ? "Running…" : "Run research"}
        </button>
      }
    >
      <div className="space-y-4">
        {ws.useMock ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
            Mock mode. Unset mock flags to call{" "}
            <code className="text-[11px]">POST /research-stats/run</code> (overwrites{" "}
            <code className="text-[11px]">MarketEval#research-latest</code>). Symbol must have
            stored candles.
          </p>
        ) : (
          <p className="text-[11px] text-ocean-sand">
            Live: evaluates stored candles for the date range, then overwrites{" "}
            <code className="text-ocean-foam/80">research-latest</code>.
          </p>
        )}

        {ws.catalogError ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
            Catalog: {ws.catalogError}
          </p>
        ) : null}

        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ws.submit();
          }}
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={LABEL} htmlFor="research-name">
              Research name
            </label>
            <input
              id="research-name"
              className={FIELD}
              value={ws.name}
              onChange={(e) => ws.setName(e.target.value)}
              placeholder="Research 1"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="research-symbol">
              Ticker (free input)
            </label>
            <input
              id="research-symbol"
              className={FIELD}
              value={ws.symbol}
              onChange={(e) => ws.setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="research-tf">
              Timeframe
            </label>
            <select
              id="research-tf"
              className={FIELD}
              value={ws.timeframe}
              onChange={(e) =>
                ws.setTimeframe(e.target.value as "15m" | "1h" | "D")
              }
            >
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="D">Daily</option>
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="research-start">
              Start date (ET)
            </label>
            <input
              id="research-start"
              type="date"
              className={FIELD}
              value={ws.startDate}
              onChange={(e) => ws.setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="research-end">
              End date (ET)
            </label>
            <input
              id="research-end"
              type="date"
              className={FIELD}
              value={ws.endDate}
              onChange={(e) => ws.setEndDate(e.target.value)}
            />
          </div>
          <div>
            <span className={LABEL}>Scope</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(BTN_SECONDARY, ws.mode === "strategy" && "bg-ocean-teal/20")}
                onClick={() => ws.setMode("strategy")}
              >
                Strategy
              </button>
              <button
                type="button"
                className={cn(BTN_SECONDARY, ws.mode === "rules" && "bg-ocean-teal/20")}
                onClick={() => ws.setMode("rules")}
              >
                Rules
              </button>
            </div>
          </div>
        </form>

        {ws.mode === "strategy" ? (
          <div className="space-y-2">
            <label className={LABEL} htmlFor="research-strategy">
              Strategy (catalog — standard or dynamic)
            </label>
            <select
              id="research-strategy"
              className={FIELD}
              value={ws.strategyId}
              disabled={ws.catalogLoading}
              onChange={(e) => ws.setStrategyId(e.target.value)}
            >
              {ws.catalogLoading ? (
                <option value="">Loading catalog…</option>
              ) : (
                <>
                  <option value="">Select strategy…</option>
                  {ws.strategies.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{resolveStrategyTier(s)}] {s.name} ({s.id})
                    </option>
                  ))}
                </>
              )}
            </select>
            {ws.selectedStrategy ? (
              <p className="text-[11px] text-ocean-sand">
                Eval uses the strategy definition as-is ({ws.selectedStrategy.rules.length}{" "}
                rules). True = existing strategy score/pass logic.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className={LABEL}>
                Add rules ({ws.timeframe} library) — set trend/operation when required; tag UP or
                DOWN movement
              </p>
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 p-2">
                {ws.catalogLoading ? (
                  <span className="text-[11px] text-ocean-sand">Loading rules…</span>
                ) : !ws.rulesForTimeframe.length ? (
                  <span className="text-[11px] text-ocean-sand">
                    No catalog rules for {ws.timeframe}.
                  </span>
                ) : (
                  ws.rulesForTimeframe.map((tpl) => (
                    <button
                      key={tpl.ruleKey}
                      type="button"
                      className="rounded-md border border-ocean-mid/40 px-2 py-1 text-left text-[11px] text-ocean-sand hover:border-ocean-teal/40 hover:text-ocean-foam"
                      onClick={() => ws.addRule(tpl)}
                      title={tpl.label}
                    >
                      <span className="font-mono text-ocean-foam/90">{tpl.ruleKey}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {ws.selectedRules.length ? (
              <ul className="space-y-2">
                {ws.selectedRules.map((row) => {
                  const tpl = ws.templateByKey.get(row.ruleKey);
                  const needTrend = ws.templateNeedsTrend(tpl);
                  const needOp = ws.templateNeedsOperation(tpl);
                  return (
                    <li
                      key={`${row.ruleKey}-${row.movement}`}
                      className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <code className="text-[11px] text-ocean-foam">{row.ruleKey}</code>
                          {row.label ? (
                            <p className="mt-0.5 text-[11px] text-ocean-sand">{row.label}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="text-[11px] text-rose-300 hover:underline"
                          onClick={() => ws.removeRule(row.ruleKey, row.movement)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-ocean-sand">
                          Movement
                          <select
                            className={cn(FIELD, "w-auto")}
                            value={row.movement}
                            onChange={(e) =>
                              ws.updateRule(row.ruleKey, row.movement, {
                                movement: e.target.value as ResearchMovementDirection,
                              })
                            }
                          >
                            <option value="up">UP</option>
                            <option value="down">DOWN</option>
                          </select>
                        </label>
                        {(needTrend || row.trend) && (
                          <label className="flex items-center gap-1 text-[11px] text-ocean-sand">
                            Trend
                            <select
                              className={cn(FIELD, "w-auto")}
                              value={row.trend ?? ""}
                              onChange={(e) => {
                                const trend = e.target.value as
                                  | "up"
                                  | "down"
                                  | "lateral"
                                  | "";
                                ws.updateRule(row.ruleKey, row.movement, {
                                  trend: trend || undefined,
                                });
                              }}
                            >
                              <option value="">—</option>
                              <option value="up">up</option>
                              <option value="down">down</option>
                              <option value="lateral">lateral</option>
                            </select>
                          </label>
                        )}
                        {(needOp || row.operation) && (
                          <label className="flex items-center gap-1 text-[11px] text-ocean-sand">
                            Operation
                            <select
                              className={cn(FIELD, "w-auto")}
                              value={row.operation ?? ""}
                              onChange={(e) => {
                                const operation = e.target.value as "call" | "put" | "";
                                ws.updateRule(row.ruleKey, row.movement, {
                                  operation: operation || undefined,
                                });
                              }}
                            >
                              <option value="">—</option>
                              <option value="call">call</option>
                              <option value="put">put</option>
                            </select>
                          </label>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[11px] text-ocean-sand">No rules added yet.</p>
            )}
          </div>
        )}

        {ws.error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
            {ws.error}
          </p>
        ) : null}

        {ws.result ? (
          <div className="space-y-4 border-t border-ocean-mid/40 pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ocean-foam">
                  {ws.result.request.name} · {ws.result.request.symbol} ·{" "}
                  {ws.result.request.timeframe} · {ws.result.request.startDate} →{" "}
                  {ws.result.request.endDate}
                </p>
                <p className="mt-0.5 text-[11px] text-ocean-sand">{ws.result.message}</p>
              </div>
              <p className="text-[11px] text-ocean-sand">
                {ws.result.overwritten ? "overwrote LATEST · " : ""}
                <code className="text-ocean-foam/80">{ws.result.runId}</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Sessions", ws.result.summary.sessionsEvaluated],
                [
                  ws.result.request.mode === "strategy" ? "Strategy true" : "Rules true",
                  ws.result.request.mode === "strategy"
                    ? (ws.result.summary.strategyTrueTotal ?? "—")
                    : (ws.result.summary.rulesTrueTotal ?? "—"),
                ],
                ["UP", ws.result.summary.movementsUp],
                ["DOWN", ws.result.summary.movementsDown],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-ocean-sand">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-ocean-foam">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-semibold text-ocean-foam">
                Hits by hour (ET)
              </h3>
              {ws.result.request.mode === "strategy" ? (
                <div className="space-y-2">
                  {ws.result.byHour.strategy.map((strat: StrategyHourStat) => (
                    <div
                      key={strat.hourEt}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2 text-[11px]"
                    >
                      <span className="font-semibold text-ocean-foam">{strat.hourEt}:00 ET</span>
                      <span className="tabular-nums text-ocean-sand">
                        true {strat.trueCount}/{strat.evalCount}{" "}
                        <span className="text-ocean-teal">({strat.trueRatePct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupRulesByHour(ws.result.byHour.rules).map(([hour, rows]) => (
                    <div
                      key={hour}
                      className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2"
                    >
                      <p className="mb-2 font-semibold text-ocean-foam">{hour}:00 ET</p>
                      <ul className="space-y-1">
                        {rows.map((row) => (
                          <li
                            key={`${hour}-${row.ruleKey}-${row.movement}`}
                            className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                          >
                            <span>
                              <code className="text-ocean-foam/90">{row.ruleKey}</code>{" "}
                              <span
                                className={
                                  row.movement === "up" ? "text-emerald-400" : "text-rose-400"
                                }
                              >
                                {row.movement.toUpperCase()}
                              </span>
                            </span>
                            <span className="tabular-nums text-ocean-sand">
                              {row.trueCount}/{row.evalCount}{" "}
                              <span className="text-ocean-teal">({row.trueRatePct}%)</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-display text-sm font-semibold text-ocean-foam">
                  Movements (UP / DOWN)
                </h3>
                <ul className="space-y-2">
                  {ws.result.movements.map((m) => (
                    <li
                      key={m.atEt}
                      className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono text-[11px] text-ocean-foam">{m.atEt}</span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            m.direction === "up" ? "text-emerald-400" : "text-rose-400",
                          )}
                        >
                          {m.direction.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-ocean-sand">
                        Hour {m.hourEt}:00
                        {ws.result?.request.mode === "strategy"
                          ? ` · strategy ${m.strategyTrue ? "true" : "false"}`
                          : ` · matched: ${m.matchedRuleKeys.join(", ") || "—"}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-display text-sm font-semibold text-ocean-foam">
                  Rules ↔ movements
                </h3>
                {ws.result.movementCommonality.length ? (
                  <div className="space-y-2">
                    {ws.result.movementCommonality.map((block) => (
                      <CommonalityBlock key={block.direction} block={block} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-ocean-sand">
                    Strategy mode — use strategy true/false on each UP/DOWN movement (no rule set).
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="border-t border-ocean-mid/40 pt-3 text-ocean-sand">
            Name the research, pick ticker + dates + timeframe, then a catalog strategy{" "}
            <em>or</em> a rule group (with UP/DOWN). Running overwrites the previous saved result.
          </p>
        )}
      </div>
    </AdminExpandedPane>
  );
}
