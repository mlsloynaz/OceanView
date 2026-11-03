import { useEffect, useRef, useState } from "react";
import { getTickersCatalog } from "@/features/admin/tickers/api/tickers-client";
import { cn } from "@/shared/lib/cn";
import { ActiveTickerBoard } from "./ActiveTickerBoard";
import { fetchMovementWatchJobStatus, type MovementWatchJobStatus } from "./alarm-client";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function regularHoursNow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function ThumbnailGridWindow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [tickers, setTickers] = useState<Array<{ symbol: string; name?: string }>>([]);
  const [tickersReady, setTickersReady] = useState(false);
  const [job, setJob] = useState<MovementWatchJobStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sessionOpen = typeof job?.marketOpen === "boolean" ? job.marketOpen : regularHoursNow();
  const live = sessionOpen && (Boolean(job?.live) || job?.status === "running");

  useEffect(() => {
    let cancel = false;
    void getTickersCatalog()
      .then((payload) => {
        if (cancel) return;
        setTickers(
          (payload.tickers ?? [])
            .filter((ticker) => ticker.active !== false)
            .map((ticker) => ({
              symbol: ticker.symbol.trim().toUpperCase(),
              name: ticker.name ?? undefined,
            }))
            .filter((ticker) => ticker.symbol),
        );
        setTickersReady(true);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setError(err instanceof Error ? err.message : "Failed to load tickers.");
        setTickersReady(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const load = () => {
      void fetchMovementWatchJobStatus()
        .then((next) => {
          if (!cancel) setJob(next);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    setRefreshKey((value) => value + 1);
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || document.fullscreenElement) return;
    void node.requestFullscreen().catch(() => {});
  }, []);

  const toggleFullscreen = () => {
    const node = rootRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      void document.exitFullscreen();
      return;
    }
    void node.requestFullscreen();
  };

  return (
    <div ref={rootRef} className="flex h-dvh flex-col bg-ocean-deep text-ocean-foam">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ocean-mid/30 px-3 py-2">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold">Thumbnail grid</h1>
          <p className="text-[11px] text-ocean-sand">
            {tickers.length} active ticker{tickers.length === 1 ? "" : "s"}
            {live ? " · Live" : ""}
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
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {error ? <p className="mb-2 text-xs text-ocean-danger">{error}</p> : null}
        {tickersReady ? (
          <ActiveTickerBoard tickers={tickers} refreshKey={refreshKey} live={live} />
        ) : (
          <p className="text-[11px] text-ocean-sand">Loading tickers…</p>
        )}
      </div>
    </div>
  );
}
