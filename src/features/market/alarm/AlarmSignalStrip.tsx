import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { formatEarningPctLabel, resolveEarningPct } from "./alarm-enter-pool";
import type { AlarmPopupState } from "./alarm-types";

export const ALARM_STRIP_CHANNEL = "oceanview-alarm-strip";

export type AlarmStripTag = {
  id: string;
  symbol: string;
  operation: string;
  earningPct: number | null;
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

function byEarning(left: AlarmStripTag, right: AlarmStripTag): number {
  const leftEarn = left.earningPct ?? Number.NEGATIVE_INFINITY;
  const rightEarn = right.earningPct ?? Number.NEGATIVE_INFINITY;
  if (rightEarn !== leftEarn) return rightEarn - leftEarn;
  return left.symbol.localeCompare(right.symbol);
}

/** Top estimated earning first. One tag per entry or exit. */
export function alarmStripTags(popup: AlarmPopupState | null): AlarmStripTag[] {
  if (!popup) return [];
  if (popup.kind === "exit") {
    const watch = popup.watch;
    return [
      {
        id: watch.id,
        symbol: watch.symbol,
        operation: operationLabel("exit", watch.lastDetectedTrend ?? watch.trend),
        earningPct: resolveEarningPct(watch.lastOptionGainPct, watch.exitEvidence ?? watch.lastEvidence),
      },
    ];
  }
  const rows =
    popup.poolEntries && popup.poolEntries.length > 0
      ? popup.poolEntries.map((row) => ({
          id: row.watchId,
          symbol: row.symbol,
          operation: operationLabel("enter", row.sideLabel),
          earningPct: row.earningPct,
        }))
      : [
          {
            id: popup.watch.id,
            symbol: popup.watch.symbol,
            operation: operationLabel("enter", popup.watch.lastDetectedTrend ?? popup.watch.trend),
            earningPct: resolveEarningPct(popup.watch.lastOptionGainPct, popup.watch.lastEvidence),
          },
        ];
  return [...rows].sort(byEarning);
}

export function AlarmSignalStrip({
  tags,
  onClose,
}: {
  tags: AlarmStripTag[];
  onClose: () => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div
      className="sticky top-0 z-30 flex w-full items-center gap-2 border-b border-ocean-mid/40 bg-ocean-deep/95 px-1 py-1.5"
      role="status"
      aria-label="Entry and exit alerts"
    >
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {tags.map((tag, index) => {
          const exit = tag.operation.startsWith("Exit");
          return (
            <span
              key={tag.id}
              className={cn(
                "inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                exit ? "bg-amber-400 text-ocean-deep" : "bg-ocean-teal text-ocean-deep",
                index === 0 ? "ring-2 ring-white/80" : "",
              )}
            >
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
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Hide alerts"
        className="shrink-0 rounded px-2 py-1 text-sm font-bold leading-none text-ocean-sand hover:bg-ocean-mid/30"
        onClick={onClose}
      >
        X
      </button>
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
