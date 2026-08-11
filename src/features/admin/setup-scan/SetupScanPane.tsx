import { cn } from "@/shared/lib/cn";
import { useEffect, useState } from "react";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { LiveSimulateControl } from "@/shared/components/LiveSimulateControl";
import { maxSimulationSessionDate } from "@/shared/lib/market-calendar";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { setupScanApiBaseUrl, setupScanUsesMock } from "./api/preselection-client";
import {
  helpForCriterion,
  SETUP_SCAN_TIER_HELP,
  criterionKeyFromReason,
} from "./criterion-help";
import { useSetupScanPane } from "./hooks/useSetupScanPane";
import { SemiFinalTickerSearch } from "./SemiFinalTickerSearch";
import { SetupScanViewToggle } from "./SetupScanViewToggle";
import type {
  PreselectionBreakdownRow,
  PreselectionStrategyGroup,
  PreselectionStrategySuggestion,
  PreselectionTickerGroup,
  PreselectionTickerRow,
} from "./types";

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  caution: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");

const BTN_SECONDARY = cn(
  BTN,
  "border-2 border-ocean-teal bg-ocean-deep text-ocean-foam hover:bg-ocean-teal/10",
);

function tierLabel(tier: string) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function BreakdownRow({ row }: { row: PreselectionBreakdownRow }) {
  const help = helpForCriterion(row.key);
  return (
    <li className="rounded border border-ocean-mid/40 bg-ocean-deep/40 px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-ocean-foam">{help?.title ?? row.key}</span>
          {help && (
            <p className="mt-1 leading-relaxed text-ocean-sand/90">{help.description}</p>
          )}
        </div>
        <span className={cn("shrink-0 tabular-nums", row.met ? "text-ocean-teal" : "text-ocean-sand")}>
          {row.points}/{row.maxPoints}
        </span>
      </div>
      <p className="mt-2 border-t border-ocean-mid/30 pt-2 text-ocean-sand">
        <span className="font-medium text-ocean-foam/90">{row.met ? "Met:" : "Not met:"}</span>{" "}
        {row.label}
      </p>
    </li>
  );
}

function ReasonLine({ line }: { line: string }) {
  const key = criterionKeyFromReason(line);
  const help = key ? helpForCriterion(key) : null;
  return (
    <li className="leading-relaxed">
      <span className="text-ocean-foam">{line}</span>
      {help && (
        <p className="mt-0.5 text-[11px] text-ocean-sand/85">{help.description}</p>
      )}
    </li>
  );
}

function AvoidLine({ line }: { line: string }) {
  const key = criterionKeyFromReason(line);
  const help = key ? helpForCriterion(key) : null;
  return (
    <li className="leading-relaxed">
      <span className="font-medium text-amber-900 dark:text-amber-100">
        {help?.title ?? line.split(":")[0]}
      </span>
      {help ? (
        <p className="mt-0.5 text-[11px] text-amber-900/90 dark:text-amber-100/90">{help.description}</p>
      ) : null}
      <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-100/80">{line}</p>
    </li>
  );
}

function suggestionToTickerRow(
  group: PreselectionTickerGroup,
  suggestion: PreselectionStrategySuggestion,
): PreselectionTickerRow {
  return {
    symbol: group.symbol,
    name: group.name,
    currentlyActive: group.currentlyActive,
    ready: true,
    score: suggestion.score,
    maxScore: suggestion.maxScore,
    tier: suggestion.tier,
    directionBias: group.directionBias,
    reasons: suggestion.reasons,
    avoidReasons: suggestion.avoidReasons,
    breakdown: suggestion.breakdown,
    candidateRules: suggestion.candidateRules,
    requiredPassed: suggestion.requiredPassed,
    hintNudge: suggestion.hintNudge,
    strategyHints: suggestion.strategyHints,
    flags: suggestion.flags,
    summaryLines: suggestion.summaryLines,
  };
}

function StrategySuggestionBlock({
  suggestion,
  onOpenDetail,
}: {
  suggestion: PreselectionStrategySuggestion;
  onOpenDetail: () => void;
}) {
  const metCriteria = (suggestion.breakdown ?? []).filter((row) => row.met);
  const unmetCriteria = (suggestion.breakdown ?? []).filter((row) => !row.met);

  return (
    <li className="rounded-lg border border-ocean-mid/35 bg-ocean-deep/25 px-3 py-2">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-left"
        onClick={onOpenDetail}
      >
        <span className="font-medium text-ocean-foam">
          {suggestion.shortName || suggestion.strategyName}
        </span>
        <span
          className={cn(
            "inline rounded px-1.5 py-0.5 text-[10px] font-medium",
            TIER_CLASS[suggestion.tier] ?? TIER_CLASS.skip,
          )}
        >
          {suggestion.score}/{suggestion.maxScore} · {tierLabel(String(suggestion.tier))}
        </span>
      </button>

      {metCriteria.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-teal">
            Criteria met
          </p>
          <ul className="mt-1 space-y-1">
            {metCriteria.map((row) => (
              <CriterionSummary key={row.key} row={row} met />
            ))}
          </ul>
        </div>
      )}

      {unmetCriteria.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
            Not met
          </p>
          <ul className="mt-1 space-y-1">
            {unmetCriteria.map((row) => (
              <CriterionSummary key={row.key} row={row} met={false} />
            ))}
          </ul>
        </div>
      )}

      {(suggestion.avoidReasons ?? []).length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-ocean-mid/30 pt-2">
          {suggestion.avoidReasons.map((line) => (
            <AvoidLine key={line} line={line} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CriterionSummary({ row, met }: { row: PreselectionBreakdownRow; met: boolean }) {
  const help = helpForCriterion(row.key);
  return (
    <li className="text-xs leading-relaxed text-ocean-sand">
      <span className={met ? "text-ocean-teal" : "text-ocean-sand/90"}>
        {help?.title ?? row.key}
      </span>
      <span className="ml-1 tabular-nums text-ocean-sand/80">
        ({row.points}/{row.maxPoints})
      </span>
      <span className="block text-[11px] text-ocean-sand/85">{row.label}</span>
    </li>
  );
}

function TickerGroupSection({
  group,
  pending,
  defaultOpen = false,
  onToggleActive,
  onOpenDetail,
}: {
  group: PreselectionTickerGroup;
  pending: boolean;
  defaultOpen?: boolean;
  onToggleActive: () => void;
  onOpenDetail: (suggestion: PreselectionStrategySuggestion) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <section className="mb-3 last:mb-0 overflow-hidden rounded-lg border border-ocean-mid/40 bg-ocean-deep/20">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn(
              "h-4 w-4 shrink-0 text-ocean-sand transition-transform",
              open && "rotate-180",
            )}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="font-display text-lg text-ocean-foam">{group.symbol}</h3>
          {group.name && <span className="text-sm text-ocean-sand">{group.name}</span>}
          <span className="rounded bg-ocean-teal/15 px-2 py-0.5 text-xs font-medium text-ocean-teal-dim dark:text-ocean-teal">
            {group.directionBias}
          </span>
          <span className="text-xs text-ocean-sand">
            {group.suggestions.length} strateg
            {group.suggestions.length === 1 ? "y" : "ies"}
          </span>
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-ocean-mid/60 px-2 py-1 text-xs text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
          onClick={onToggleActive}
        >
          {pending ? "…" : group.currentlyActive ? "Deactivate" : "Activate"}
        </button>
      </div>

      {open ? (
        <ul className="space-y-2 border-t border-ocean-mid/30 px-3 py-2">
          {group.suggestions.map((suggestion) => (
            <StrategySuggestionBlock
              key={suggestion.strategyId}
              suggestion={suggestion}
              onOpenDetail={() => onOpenDetail(suggestion)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function StrategyGroupSection({
  group,
  tickerPending,
  defaultOpen = false,
  onToggleActive,
  onOpenDetail,
}: {
  group: PreselectionStrategyGroup;
  tickerPending: Record<string, boolean>;
  defaultOpen?: boolean;
  onToggleActive: (symbol: string, currentlyActive: boolean) => void;
  onOpenDetail: (ticker: PreselectionTickerRow) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const title = group.shortName || group.name || group.strategyId;

  return (
    <section className="mb-3 last:mb-0 overflow-hidden rounded-lg border border-ocean-mid/40 bg-ocean-deep/20">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn(
              "h-4 w-4 shrink-0 text-ocean-sand transition-transform",
              open && "rotate-180",
            )}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="font-display text-lg text-ocean-foam">{title}</h3>
          {group.shortName && group.name && group.shortName !== group.name ? (
            <span className="text-sm text-ocean-sand">{group.name}</span>
          ) : null}
          <span className="text-xs text-ocean-sand">
            {group.tickers.length} ticker{group.tickers.length === 1 ? "" : "s"}
          </span>
        </button>
      </div>

      {open ? (
        <ul className="space-y-2 border-t border-ocean-mid/30 px-3 py-2">
          {group.tickers.map((ticker) => {
            const pending = Boolean(tickerPending[ticker.symbol.toUpperCase()]);
            return (
              <li
                key={ticker.symbol}
                className="rounded-lg border border-ocean-mid/35 bg-ocean-deep/25 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                    onClick={() => onOpenDetail(ticker)}
                  >
                    <span className="font-medium text-ocean-foam">{ticker.symbol}</span>
                    {ticker.name ? (
                      <span className="truncate text-xs text-ocean-sand">{ticker.name}</span>
                    ) : null}
                    {ticker.directionBias ? (
                      <span className="rounded bg-ocean-teal/15 px-1.5 py-0.5 text-[10px] font-medium text-ocean-teal-dim dark:text-ocean-teal">
                        {ticker.directionBias}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "inline rounded px-1.5 py-0.5 text-[10px] font-medium",
                        TIER_CLASS[ticker.tier] ?? TIER_CLASS.skip,
                      )}
                    >
                      {ticker.score}/{ticker.maxScore} · {tierLabel(String(ticker.tier))}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-ocean-mid/60 px-2 py-1 text-xs text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
                    onClick={() => onToggleActive(ticker.symbol, ticker.currentlyActive)}
                  >
                    {pending ? "…" : ticker.currentlyActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function DetailModal({
  strategyName,
  ticker,
  onClose,
}: {
  strategyName: string;
  ticker: PreselectionTickerRow;
  onClose: () => void;
}) {
  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={ticker.symbol}
      subtitle={[ticker.name, strategyName].filter(Boolean).join(" · ")}
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", TIER_CLASS[ticker.tier] ?? TIER_CLASS.skip)}>
            {tierLabel(ticker.tier)} · {ticker.score}/{ticker.maxScore}
          </span>
          {ticker.directionBias && (
            <span className="rounded bg-ocean-deep px-2 py-0.5 text-xs text-ocean-foam">{ticker.directionBias}</span>
          )}
          <span className="rounded bg-ocean-deep px-2 py-0.5 text-xs text-ocean-sand">
            {ticker.currentlyActive ? "Active" : "Inactive"}
          </span>
        </div>

        <p className="rounded-lg border border-ocean-mid/35 bg-ocean-deep/25 px-3 py-2 text-[11px] leading-relaxed text-ocean-sand">
          {SETUP_SCAN_TIER_HELP}
        </p>

        {Array.isArray(ticker.reasons) && ticker.reasons.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Points earned
            </h3>
            <ul className="list-none space-y-2 pl-0">
              {ticker.reasons.map((line) => (
                <ReasonLine key={line} line={line} />
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(ticker.avoidReasons) && ticker.avoidReasons.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Avoid flags
            </h3>
            <ul className="list-none space-y-2 pl-0">
              {ticker.avoidReasons.map((line) => (
                <AvoidLine key={line} line={line} />
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(ticker.candidateRules) && ticker.candidateRules.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Candidate rules
            </h3>
            <ul className="space-y-2">
              {ticker.candidateRules.map((row) => (
                <li
                  key={`${row.pathGroup ?? "default"}:${row.ruleKey}:${row.pathVariant ?? ""}`}
                  className="rounded border border-ocean-mid/40 bg-ocean-deep/40 px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ocean-foam">
                      {row.label || row.ruleKey}
                    </span>
                    <span className="font-mono text-[10px] text-ocean-sand/80">{row.ruleKey}</span>
                    <span className="text-[10px] uppercase text-ocean-sand">
                      {row.type ?? "required"}
                      {row.pathGroup && row.pathGroup !== "default"
                        ? ` · ${row.pathGroup}`
                        : ""}
                      {row.pathVariant ? ` · ${row.pathVariant}` : ""}
                      {row.when ? ` · ${row.when}` : ""}
                    </span>
                    <span
                      className={
                        row.status === "met" || row.status === "near"
                          ? "text-ocean-teal"
                          : row.status === "skipped"
                            ? "text-ocean-sand/70"
                            : "text-amber-800 dark:text-amber-100"
                      }
                    >
                      {row.status}
                    </span>
                  </div>
                  {row.evidence ? (
                    <p className="mt-1 text-ocean-sand/90">{row.evidence}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(ticker.strategyHints) && ticker.strategyHints.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Strategy hints
              {typeof ticker.hintNudge === "number" && ticker.hintNudge !== 0
                ? ` (nudge ${ticker.hintNudge > 0 ? "+" : ""}${ticker.hintNudge})`
                : ""}
            </h3>
            <ul className="list-none space-y-1 pl-0 text-xs text-ocean-sand">
              {ticker.strategyHints.map((hint, idx) => (
                <li key={`${hint.id ?? "h"}-${idx}`}>
                  {String(hint.message || hint.label || hint.id || "hint")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(ticker.summaryLines) && ticker.summaryLines.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Summary
            </h3>
            <ul className="list-none space-y-1 pl-0 text-xs text-ocean-sand">
              {ticker.summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(ticker.breakdown) && ticker.breakdown.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Soft profile checklist
            </h3>
            <ul className="space-y-2">
              {ticker.breakdown.map((row) => (
                <BreakdownRow key={row.key} row={row} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </MarketDetailModal>
  );
}

export function SetupScanPane() {
  const ws = useSetupScanPane(true);
  const usesMock = setupScanUsesMock();
  const apiBase = setupScanApiBaseUrl();
  const byStrategy = ws.viewMode === "strategies";

  return (
    <>
      <AdminExpandedPane
        id="admin-setup-scan-pane"
        title="Tickers SemiFinal"
        subtitle={
          usesMock
            ? "Mock data (VITE_USE_MOCK_SETUP_SCAN or VITE_USE_MOCK_CANDLES)"
            : byStrategy
              ? "D+1h preselection — strategies with CALL/PUT candidates"
              : "D+1h preselection — tickers with CALL/PUT bias, grouped by symbol"
        }
        className="min-w-0"
        headerExtra={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SetupScanViewToggle
              mode={ws.viewMode}
              onChange={ws.setViewMode}
              disabled={ws.runPending || ws.loading}
            />
            <div
              className="inline-flex rounded-md border border-ocean-mid/50 p-0.5"
              role="group"
              aria-label="SemiFinal candidate mode"
            >
              <button
                type="button"
                className={cn(
                  BTN,
                  "px-2 py-1",
                  ws.candidateMode === "eod"
                    ? "bg-ocean-teal text-ocean-deep"
                    : "text-ocean-sand hover:bg-ocean-mid/20",
                )}
                disabled={ws.runPending || ws.loading}
                onClick={() => ws.setCandidateMode("eod")}
              >
                EOD (history)
              </button>
              <button
                type="button"
                className={cn(
                  BTN,
                  "px-2 py-1",
                  ws.candidateMode === "open"
                    ? "bg-ocean-teal text-ocean-deep"
                    : "text-ocean-sand hover:bg-ocean-mid/20",
                )}
                disabled={ws.runPending || ws.loading}
                onClick={() => ws.setCandidateMode("open")}
              >
                9:25 (visual)
              </button>
            </div>
            <LiveSimulateControl
              mode={ws.scanMode}
              onModeChange={ws.setScanMode}
              disabled={ws.runPending || ws.loading}
              variant="compact"
              simulateInput="date"
              simulateValue={ws.simulationDate}
              onSimulateChange={ws.setSimulationDate}
              simulateInputId="setup-scan-session-date"
              simulateLabel="Session"
              simulateMax={maxSimulationSessionDate()}
              showLiveClock={false}
              ariaLabel="Tickers SemiFinal mode"
            />
            <label className="flex items-center gap-1 text-[11px] text-ocean-sand">
              Min score
              <input
                type="number"
                min={0}
                max={30}
                value={ws.minScore}
                onChange={(e) => ws.setMinScore(Number(e.target.value) || 0)}
                className="w-12 rounded border border-ocean-mid/60 bg-ocean-deep px-1 py-0.5 text-ocean-foam"
              />
            </label>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={ws.runPending || ws.loading}
              onClick={() => ws.runScan()}
            >
              {ws.runPending
                ? "Scanning…"
                : ws.candidateMode === "open"
                  ? "Run 9:25 visual"
                  : "Run Tickers SemiFinal"}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={ws.loading || ws.runPending}
              onClick={() => void ws.loadResult()}
            >
              {ws.loading ? "…" : "Reload EOD result"}
            </button>
          </div>
        }
      >
        {!usesMock && apiBase && (
          <p className="mb-2 truncate text-[11px] text-ocean-sand/70" title={apiBase}>
            API: {apiBase}
          </p>
        )}

        <p className="mb-3 text-xs text-ocean-sand">
          Soft profile score + per-strategy candidate rules + foundation hints.{" "}
          <strong className="font-medium text-ocean-foam">EOD</strong> uses saved history and
          persists the SemiFinal roster.{" "}
          <strong className="font-medium text-ocean-foam">9:25 visual</strong> merges history with
          in-memory premarket bars (not written to Dynamo) and does not overwrite the saved EOD
          result.
        </p>

        {ws.candidateMode === "open" ? (
          <div
            className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
            role="status"
          >
            Viewing 9:25 visual mode — results are session-only and do not replace the saved EOD
            SemiFinal.
            {!ws.result ? " Run a 9:25 scan to populate this view." : null}
          </div>
        ) : null}

        <p className="mb-3 text-xs text-ocean-sand">
          Scans all catalog tickers (active and inactive). Only symbols with a resolved direction
          bias (CALL or PUT) appear here
          {byStrategy
            ? " — toggle to group by strategy or by ticker."
            : ", grouped by ticker with strategy suggestions from assessed criteria."}{" "}
          Live mode refreshes stale candles through the last completed session. Simulate mode scores
          post-market of a chosen session day using stored bars only — no candle refresh.
        </p>

        {ws.scanMode === "simulate" && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Simulation uses session close (4:00 PM ET, or 1:00 PM on early-close days). Pick a
            NYSE market day — weekends and holidays are rejected. On weekends, the default is the
            last session (e.g. {maxSimulationSessionDate()}).
          </p>
        )}

        {ws.result?.simulated && (
          <p className="mb-3 rounded-lg border border-ocean-teal/40 bg-ocean-teal/10 px-3 py-2 text-xs text-ocean-foam">
            Simulated post-market scan for {ws.result.simulationDate ?? ws.result.tradeDate}
            {ws.result.simulationTimeEt ? ` · anchor ${ws.result.simulationTimeEt}` : ""}.
          </p>
        )}

        {ws.message && (
          <p className="mb-2 text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
            {ws.message}
          </p>
        )}
        {ws.error && (
          <p className="mb-2 text-sm text-ocean-danger" role="alert">
            {ws.error}
          </p>
        )}

        {ws.result?.candles && (
          <p className="mb-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2 text-xs text-ocean-sand">
            Candles: {ws.result.candles.symbolsRefreshed ?? 0} refreshed of{" "}
            {ws.result.candles.symbolsStale ?? 0} stale / {ws.result.candles.symbolsTotal ?? 0} total
            {ws.result.candles.skippedRefresh ? " (refresh skipped)" : ""}.
            {ws.result.tradeDate ? ` Trade date ${ws.result.tradeDate}.` : ""}
          </p>
        )}

        {ws.result && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SemiFinalTickerSearch
              value={ws.search}
              suggestions={ws.searchSuggestions}
              disabled={ws.loading || ws.runPending}
              onChange={ws.setSearch}
              onSelect={ws.selectSearchTicker}
            />
            {ws.search.trim() ? (
              <button
                type="button"
                disabled={ws.loading || ws.runPending}
                onClick={() => ws.setSearch("")}
                className="rounded px-2 py-1 text-xs font-medium text-ocean-sand hover:text-ocean-foam"
              >
                Clear
              </button>
            ) : null}
            {ws.search.trim() ? (
              <span className="text-[11px] text-ocean-sand/80">
                {ws.searchMatchCount} match{ws.searchMatchCount === 1 ? "" : "es"}
              </span>
            ) : null}
          </div>
        )}

        {!ws.result && !ws.loading && !ws.runPending && (
          <p className="text-sm text-ocean-sand">No Tickers SemiFinal result yet — run a scan to begin.</p>
        )}

        {ws.result &&
          ws.search.trim() &&
          (byStrategy ? ws.strategyGroups.length === 0 : ws.tickerGroups.length === 0) && (
          <p className="mb-3 text-sm text-ocean-sand">
            No {byStrategy ? "strategies" : "tickers"} with a selected bias match “{ws.search.trim()}”.
          </p>
        )}

        {byStrategy
          ? ws.strategyGroups.map((group) => {
              const searchExact = ws.search.trim().length > 0;
              return (
                <StrategyGroupSection
                  key={group.strategyId}
                  group={group}
                  tickerPending={ws.tickerPending}
                  defaultOpen={searchExact || ws.strategyGroups.length <= 3}
                  onToggleActive={(symbol, currentlyActive) =>
                    void ws.setActive(symbol, !currentlyActive)
                  }
                  onOpenDetail={(ticker) =>
                    ws.setDetail({
                      strategyName: group.shortName || group.name,
                      ticker,
                    })
                  }
                />
              );
            })
          : ws.tickerGroups.map((group) => {
              const pending = Boolean(ws.tickerPending[group.symbol]);
              const searchExact = ws.search.trim().toUpperCase() === group.symbol.toUpperCase();
              return (
                <TickerGroupSection
                  key={group.symbol}
                  group={group}
                  pending={pending}
                  defaultOpen={searchExact}
                  onToggleActive={() => void ws.setActive(group.symbol, !group.currentlyActive)}
                  onOpenDetail={(suggestion) =>
                    ws.setDetail({
                      strategyName: suggestion.shortName || suggestion.strategyName,
                      ticker: suggestionToTickerRow(group, suggestion),
                    })
                  }
                />
              );
            })}

        {ws.result &&
          !ws.search.trim() &&
          (byStrategy ? ws.strategyGroups.length === 0 : ws.tickerGroups.length === 0) && (
          <p className="text-sm text-ocean-sand">
            No tickers with a selected bias (CALL/PUT) at or above min score — neutral trend symbols
            are hidden.
          </p>
        )}
      </AdminExpandedPane>

      {ws.detail && (
        <DetailModal
          strategyName={ws.detail.strategyName}
          ticker={ws.detail.ticker}
          onClose={() => ws.setDetail(null)}
        />
      )}
    </>
  );
}
