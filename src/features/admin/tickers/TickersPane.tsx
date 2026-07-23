import { useCallback, useEffect, useState } from "react";
import { AdminPaneThumbnail } from "@/features/admin/components/AdminPaneThumbnail";
import { BestFitPane } from "./BestFitPane";
import { TradablePane } from "./TradablePane";
import { WatchlistPane } from "./WatchlistPane";
import {
  hashForTickersHubView,
  TICKERS_HUB,
  TICKERS_HUB_ORDER,
  tickersHubViewFromHash,
  type TickersHubView,
} from "./tickers-hub";

function IconWatchlist() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM2.75 4.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM2.75 10a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm0 5.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconBestFit() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 2a.75.75 0 01.67.415l1.98 3.99 4.41.64a.75.75 0 01.416 1.279l-3.19 3.11.753 4.39a.75.75 0 01-1.088.79L10 14.347l-3.95 2.077a.75.75 0 01-1.088-.79l.753-4.39-3.19-3.11a.75.75 0 01.416-1.28l4.41-.64 1.98-3.99A.75.75 0 0110 2z" />
    </svg>
  );
}

function IconTradable() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M3.5 3.75a.75.75 0 000 1.5h13a.75.75 0 000-1.5h-13zM3.5 9.25a.75.75 0 000 1.5h8a.75.75 0 000-1.5h-8zM3.5 14.75a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5z" />
      <path d="M14.22 9.22a.75.75 0 011.06 0l2.25 2.25a.75.75 0 010 1.06l-2.25 2.25a.75.75 0 11-1.06-1.06l.97-.97H10.75a.75.75 0 010-1.5h4.44l-.97-.97a.75.75 0 010-1.06z" />
    </svg>
  );
}

const HUB_ICONS = {
  watchlist: <IconWatchlist />,
  "best-fit": <IconBestFit />,
  tradable: <IconTradable />,
} as const;

export function TickersPane() {
  const [view, setView] = useState<TickersHubView>(() =>
    tickersHubViewFromHash(window.location.hash),
  );

  useEffect(() => {
    const sync = () => setView(tickersHubViewFromHash(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const openView = useCallback((next: TickersHubView) => {
    setView(next);
    window.history.replaceState(null, "", `${window.location.pathname}${hashForTickersHubView(next)}`);
  }, []);

  if (view === "watchlist") {
    return <WatchlistPane onBack={() => openView("hub")} />;
  }
  if (view === "best-fit") {
    return <BestFitPane onBack={() => openView("hub")} />;
  }
  if (view === "tradable") {
    return <TradablePane onBack={() => openView("hub")} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ocean-foam">Tickers</h2>
        <p className="mt-1 max-w-2xl text-sm text-ocean-sand">
          Watchlist for catalog control, Best-fit for long-term stock ranking, Tradable for option
          spreads. Open a thumbnail below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TICKERS_HUB_ORDER.map((id) => {
          const meta = TICKERS_HUB[id];
          return (
            <AdminPaneThumbnail
              key={id}
              title={meta.title}
              description={meta.description}
              icon={HUB_ICONS[id]}
              active={false}
              onClick={() => openView(id)}
            />
          );
        })}
      </div>
    </div>
  );
}
