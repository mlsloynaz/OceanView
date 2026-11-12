import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { TickerMark } from "./TickerMark";
import { formatEarningPctLabel, resolveEarningPct } from "./alarm-enter-pool";
import { watchRuleKeys, type AlarmPopupState, type MarketAlarmWatch } from "./alarm-types";
import { entryClock } from "./five-minute-entry";

export const ALARM_STRIP_CHANNEL = "oceanview-alarm-strip";

export type AlarmStripLane = "orb" | "trend";

export type AlarmStripTag = {
  id: string;
  symbol: string;
  operation: string;
  earningPct: number | null;
  lane: AlarmStripLane;
  /** Eastern clock when this entry became valid. */
  validAt: string | null;
};

export type AlarmStripMessage =
  | { type: "hello" }
  | { type: "strip"; tags: AlarmStripTag[] }
  | { type: "dismiss" };

function operationLabel(kind: "enter" | "exit", side: string | null | undefined): string {
  const value = String(side || "").trim().toLowerCase();
  const contract =
    value === "alcista" || value === "call" ? "Call" : value === "bajista" || value === "put" ? "Put" : "";
  const verb = kind === "enter" ? "Buy" : "Exit";
  return contract ? `${verb} ${contract}` : verb;
}

const TAG_COLORS = [
  "bg-teal-300 text-ocean-deep",
  "bg-sky-300 text-ocean-deep",
  "bg-amber-300 text-ocean-deep",
  "bg-rose-300 text-ocean-deep",
  "bg-lime-300 text-ocean-deep",
  "bg-violet-300 text-ocean-deep",
  "bg-orange-300 text-ocean-deep",
  "bg-cyan-200 text-ocean-deep",
];

export function alarmTagColor(index: number): string {
  return TAG_COLORS[index % TAG_COLORS.length] ?? TAG_COLORS[0];
}

export function AlarmSignalTag({ tag, index }: { tag: AlarmStripTag; index: number }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 flex-col items-center rounded-md px-2.5 py-1 text-[11px] font-semibold tabular-nums",
        alarmTagColor(index),
      )}
    >
      <span className="inline-flex items-center">
        <TickerMark symbol={tag.symbol} className="mr-1 inline-block h-3.5 w-3.5 shrink-0 rounded-full object-contain" />
        {tag.symbol}
        <span className="mx-1 font-medium opacity-70">·</span>
        {tag.operation}
        {typeof tag.earningPct === "number" ? (
          <>
            <span className="mx-1 font-medium opacity-70">·</span>
            {formatEarningPctLabel(tag.earningPct)}
          </>
        ) : null}
      </span>
      {tag.validAt ? (
        <span className="text-[9px] font-medium leading-none opacity-75">{tag.validAt}</span>
      ) : null}
    </span>
  );
}

function byEarning(left: AlarmStripTag, right: AlarmStripTag): number {
  const leftEarn = left.earningPct ?? Number.NEGATIVE_INFINITY;
  const rightEarn = right.earningPct ?? Number.NEGATIVE_INFINITY;
  if (rightEarn !== leftEarn) return rightEarn - leftEarn;
  return left.symbol.localeCompare(right.symbol);
}

function lanesFor(watch: MarketAlarmWatch): AlarmStripLane[] {
  const keys = watchRuleKeys(watch);
  const lanes: AlarmStripLane[] = [];
  if (keys.includes("orb_breakout_5m")) lanes.push("orb");
  if (keys.includes("trend_change_5m")) lanes.push("trend");
  return lanes;
}

/** When the entry became valid. Prefer the entry stamp over the poll that noticed it. */
function entryValidClock(watch: MarketAlarmWatch): string | null {
  const raw = (watch.lastEntryAt || watch.metAt || "").trim();
  if (!raw) return null;
  return entryClock(raw);
}

function tagFor(
  watch: MarketAlarmWatch,
  lane: AlarmStripLane,
  operation: string,
  earningPct: number | null,
): AlarmStripTag {
  return {
    id: `${watch.id}:${lane}`,
    symbol: watch.symbol,
    operation,
    earningPct,
    lane,
    validAt: entryValidClock(watch),
  };
}

/** Top estimated earning first. ORB and 5-minute trend stay on separate stripes. */
export function alarmStripTags(popup: AlarmPopupState | null): AlarmStripTag[] {
  if (!popup) return [];
  if (popup.kind === "exit") {
    const watch = popup.watch;
    const operation = operationLabel("exit", watch.lastDetectedTrend ?? watch.trend);
    const earningPct = resolveEarningPct(watch.lastOptionGainPct, watch.exitEvidence ?? watch.lastEvidence);
    return lanesFor(watch).map((lane) => tagFor(watch, lane, operation, earningPct));
  }
  const rows =
    popup.poolEntries && popup.poolEntries.length > 0
      ? popup.poolEntries.flatMap((row) => {
          const operation = operationLabel("enter", row.sideLabel);
          return lanesFor(row.watch).map((lane) => tagFor(row.watch, lane, operation, row.earningPct));
        })
      : lanesFor(popup.watch).map((lane) =>
          tagFor(
            popup.watch,
            lane,
            operationLabel("enter", popup.watch.lastDetectedTrend ?? popup.watch.trend),
            resolveEarningPct(popup.watch.lastOptionGainPct, popup.watch.lastEvidence),
          ),
        );
  return [...rows].sort(byEarning);
}

export function alarmStripLanes(tags: AlarmStripTag[]): { orb: AlarmStripTag[]; trend: AlarmStripTag[] } {
  return {
    orb: tags.filter((tag) => tag.lane === "orb"),
    trend: tags.filter((tag) => tag.lane === "trend"),
  };
}

const LANE_LABEL: Record<AlarmStripLane, string> = {
  orb: "ORB",
  trend: "5minTrend",
};

function AlarmLaneRow({
  lane,
  tags,
  onClose,
}: {
  lane: AlarmStripLane;
  tags: AlarmStripTag[];
  onClose: () => void;
}) {
  if (tags.length === 0) return null;
  const label = LANE_LABEL[lane];
  return (
    <div className="flex w-full items-center gap-2" role="status" aria-label={`${label} alerts`}>
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {tags.map((tag, index) => (
          <AlarmSignalTag key={tag.id} tag={tag} index={index} />
        ))}
      </div>
      <button
        type="button"
        aria-label={`Hide ${label} alerts`}
        className="shrink-0 rounded px-2 py-1 text-sm font-bold leading-none text-ocean-sand hover:bg-ocean-mid/30"
        onClick={onClose}
      >
        X
      </button>
    </div>
  );
}

export function AlarmSignalStrip({
  tags,
  onClose,
}: {
  tags: AlarmStripTag[];
  onClose: () => void;
}) {
  const lanes = alarmStripLanes(tags);
  if (lanes.orb.length === 0 && lanes.trend.length === 0) return null;
  return (
    <div className="sticky top-0 z-30 flex w-full flex-col gap-1 border-b border-ocean-mid/40 bg-ocean-deep/95 px-1 py-1.5">
      <AlarmLaneRow lane="orb" tags={lanes.orb} onClose={onClose} />
      <AlarmLaneRow lane="trend" tags={lanes.trend} onClose={onClose} />
    </div>
  );
}

/** Strip state published by the main window. The graph windows listen here. */
export function useRemoteAlarmStrip(): { tags: AlarmStripTag[]; dismiss: () => void } {
  const [tags, setTags] = useState<AlarmStripTag[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const channel = new BroadcastChannel(ALARM_STRIP_CHANNEL);
    channelRef.current = channel;
    const onMessage = (event: MessageEvent<AlarmStripMessage>) => {
      if (event.data?.type === "strip") setTags(event.data.tags ?? []);
    };
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "hello" } satisfies AlarmStripMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);
  const dismiss = () => {
    channelRef.current?.postMessage({ type: "dismiss" } satisfies AlarmStripMessage);
    setTags([]);
  };
  return { tags, dismiss };
}
