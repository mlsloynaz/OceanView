import { useEffect, useMemo, useRef, useState } from "react";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { BbSparkline15mChart } from "@/features/market/alarm/BbSparkline15mChart";
import {
  MovementWatchGrid,
  chartForWatch,
  usesFiveMinuteChart,
} from "@/features/market/alarm/MovementWatchGrid";
import {
  ALARM_ELIGIBLE_RULES,
  MOVEMENT_ALARM_RULE_KEYS,
  watchRuleKeys,
  type AlarmEligibleRuleKey,
  type MarketAlarmWatch,
} from "@/features/market/alarm/alarm-types";
import { cn } from "@/shared/lib/cn";
import {
  MOVEMENT_GRID_CHANNEL,
  type MovementGridActionName,
  type MovementGridMessage,
  type MovementGridSnapshot,
} from "./movement-grid-channel";

const EMPTY_WATCHES: MarketAlarmWatch[] = [];

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type HourRelationFilter = "all" | "WITH_TREND" | "COUNTERTREND" | "TRANSITION";

const HOUR_RELATION_OPTIONS: { value: HourRelationFilter; label: string }[] = [
  { value: "all", label: "All relations" },
  { value: "WITH_TREND", label: "With Trend" },
  { value: "COUNTERTREND", label: "Counter" },
  { value: "TRANSITION", label: "Transition" },
];

function matchesHourRelation(watch: MarketAlarmWatch, filter: HourRelationFilter): boolean {
  if (filter === "all") return true;
  return (watch.lastHourRelation ?? "").toUpperCase() === filter;
}

export function MovementGridWindow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [snapshot, setSnapshot] = useState<MovementGridSnapshot | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [chartWatchId, setChartWatchId] = useState<string | null>(null);
  const [movementFocus, setMovementFocus] = useState<AlarmEligibleRuleKey | "all">("all");
  const [hourRelationFilter, setHourRelationFilter] = useState<HourRelationFilter>("all");

  useEffect(() => {
    const channel = new BroadcastChannel(MOVEMENT_GRID_CHANNEL);
    channelRef.current = channel;
    let connected = false;
    const onMessage = (event: MessageEvent<MovementGridMessage>) => {
      if (event.data?.type === "snapshot") {
        connected = true;
        setSnapshot(event.data);
      }
    };
    channel.addEventListener("message", onMessage);
    const hello = () => {
      channel.postMessage({ type: "hello" } satisfies MovementGridMessage);
    };
    hello();
    const timer = window.setInterval(() => {
      if (!connected) hello();
    }, 1000);
    return () => {
      window.clearInterval(timer);
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      setFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const send = (action: MovementGridActionName, id: string) => {
    channelRef.current?.postMessage({
      type: "action",
      action,
      id,
    } satisfies MovementGridMessage);
  };

  const toggleFullscreen = () => {
    const node = rootRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      void document.exitFullscreen();
      return;
    }
    void node.requestFullscreen();
  };

  const watches = snapshot?.watches ?? EMPTY_WATCHES;
  const movementTabs = useMemo(() => {
    return MOVEMENT_ALARM_RULE_KEYS.filter((key) =>
      watches.some((watch) => watchRuleKeys(watch).includes(key)),
    ).map((key) => ({
      key,
      label: ALARM_ELIGIBLE_RULES.find((rule) => rule.ruleKey === key)?.label ?? key,
      count: watches.filter((watch) => watchRuleKeys(watch).includes(key)).length,
    }));
  }, [watches]);

  useEffect(() => {
    if (movementFocus === "all") return;
    if (!movementTabs.some((tab) => tab.key === movementFocus)) setMovementFocus("all");
  }, [movementFocus, movementTabs]);

  const relationWatches = useMemo(() => {
    const focused =
      movementFocus === "all"
        ? watches
        : watches.filter((watch) => watchRuleKeys(watch).includes(movementFocus));
    return focused.filter((watch) => matchesHourRelation(watch, hourRelationFilter));
  }, [hourRelationFilter, movementFocus, watches]);

  const tickerNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    for (const ticker of snapshot?.tickers ?? []) {
      if (ticker.name) map.set(ticker.symbol.toUpperCase(), ticker.name);
    }
    return map;
  }, [snapshot]);

  const chartWatch = watches.find((watch) => watch.id === chartWatchId) ?? null;
  const fiveMinute = chartWatch ? usesFiveMinuteChart(chartWatch) : false;
  const chart = chartWatch ? chartForWatch(chartWatch) : null;

  return (
    <div ref={rootRef} className="flex h-dvh flex-col bg-ocean-deep text-ocean-foam">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ocean-mid/30 px-3 py-2">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold">Movement grid</h1>
          <p className="text-[11px] text-ocean-sand">
            {snapshot
              ? `${relationWatches.length} chart${relationWatches.length === 1 ? "" : "s"} · live from OceanView`
              : "Connecting to the OceanView tab…"}
          </p>
        </div>
        <button
          type="button"
          className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam hover:bg-ocean-mid/20")}
          onClick={toggleFullscreen}
        >
          {fullscreen ? "Exit full screen" : "Full screen"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
        {movementTabs.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div
              className="flex flex-wrap gap-0.5 rounded-md border border-ocean-mid/40 bg-ocean-surface/40 p-0.5"
              role="tablist"
              aria-label="Movement type"
            >
              {movementTabs.length > 1 ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={movementFocus === "all"}
                  className={cn(
                    "rounded px-3 py-1.5 text-[11px] font-medium",
                    movementFocus === "all"
                      ? "bg-ocean-teal text-ocean-deep"
                      : "text-ocean-sand hover:text-ocean-foam",
                  )}
                  onClick={() => setMovementFocus("all")}
                >
                  All ({watches.length})
                </button>
              ) : null}
              {movementTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={movementFocus === tab.key || movementTabs.length === 1}
                  className={cn(
                    "rounded px-3 py-1.5 text-[11px] font-medium",
                    movementFocus === tab.key || movementTabs.length === 1
                      ? "bg-ocean-teal text-ocean-deep"
                      : "text-ocean-sand hover:text-ocean-foam",
                  )}
                  onClick={() => setMovementFocus(tab.key)}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-ocean-sand">
              <span>Relation</span>
              <select
                value={hourRelationFilter}
                onChange={(event) =>
                  setHourRelationFilter(event.target.value as HourRelationFilter)
                }
                className="rounded-md border border-ocean-mid/40 bg-ocean-deep px-2 py-1.5 text-[11px] font-medium text-ocean-foam"
                aria-label="Filter by 1h relation"
              >
                {HOUR_RELATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {!snapshot ? (
          <p className="text-sm text-ocean-sand">
            Leave the OceanView tab open. This window shows the movement graph grid from that
            tab.
          </p>
        ) : (
          <div className="min-h-0 flex-1">
          <MovementWatchGrid
            watches={relationWatches}
            tickerNameBySymbol={tickerNameBySymbol}
            fitViewport
            onCheckNow={(id) => send("check", id)}
            onStart={(id) => send("start", id)}
            onStop={(id) => send("stop", id)}
            onRemove={(id) => send("remove", id)}
            onConfirmEnter={(id) => send("confirmEnter", id)}
            onConfirmExit={(id) => send("confirmExit", id)}
            onClearMetStatus={(id) => send("clear", id)}
            onEnlargeChart={setChartWatchId}
          />
          </div>
        )}
      </div>

      {chartWatch ? (
        <MarketDetailModal
          open
          onClose={() => setChartWatchId(null)}
          title={`${chartWatch.symbol} · ${fiveMinute ? "5m" : (chart?.timeframe ?? "")}`}
          subtitle={
            fiveMinute ? "5m price, EMA 10, and EMA 21" : "Price, EMA 10, EMA 21, and Bollinger"
          }
          className="max-w-3xl"
        >
          <BbSparkline15mChart
            data={
              chart ??
              (fiveMinute
                ? {
                    symbol: chartWatch.symbol,
                    timeframe: "5m",
                    bbPeriod: 20,
                    bars: [],
                  }
                : null)
            }
            breakoutLevel={fiveMinute ? null : chartWatch.lastBreakoutLevel}
            variant="full"
          />
        </MarketDetailModal>
      ) : null}
    </div>
  );
}
