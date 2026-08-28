import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CandidateViewModel } from "@/features/candidates";
import {
  adaptMarketTickerCards,
  sortCandidatesByRank,
  useTradabilityTiers,
} from "@/features/candidates";
import { useAlarms } from "@/features/alarms/AlarmsProvider";
import { useMarketWorkspace } from "@/features/market/hooks/useMarketWorkspace";
import { ActiveWatchesSection } from "./components/ActiveWatchesSection";
import { CandidateDetailSection } from "./components/CandidateDetailSection";
import { MarketContextStrip } from "./components/MarketContextStrip";
import { TodayHeader } from "./components/TodayHeader";
import { TopCandidatesSection } from "./components/TopCandidatesSection";
import { defaultTodayMode, isTodayMode, todayPath } from "./lib/today-routes";

export function TodayPage() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const alarms = useAlarms();
  const liveWorkspace = useMarketWorkspace("tickers");
  const tradability = useTradabilityTiers();
  const [selected, setSelected] = useState<CandidateViewModel | null>(null);

  useEffect(() => {
    // Legacy /today/preparation and /today/replay → Live.
    if (modeParam === "preparation" || modeParam === "replay" || !isTodayMode(modeParam)) {
      navigate(todayPath(defaultTodayMode()), { replace: true });
    }
  }, [modeParam, navigate]);

  useEffect(() => {
    setSelected(null);
  }, [modeParam]);

  const liveCandidates = useMemo(
    () =>
      sortCandidatesByRank(
        adaptMarketTickerCards(liveWorkspace.filteredTickerCards, {
          updatedAt: liveWorkspace.assessmentAt?.toISOString?.() ?? new Date().toISOString(),
          tradabilityBySymbol: tradability.bySymbol,
        }),
      ),
    [liveWorkspace.filteredTickerCards, liveWorkspace.assessmentAt, tradability.bySymbol],
  );

  return (
    <div className="w-full space-y-4">
      <TodayHeader
        activeWatchCount={alarms.runningCount}
        candidateCount={liveCandidates.length}
        onRefresh={() => {
          void liveWorkspace.refreshResult();
          void tradability.refresh();
        }}
        refreshPending={liveWorkspace.refreshPending || tradability.loading}
      />

      <MarketContextStrip />

      <TopCandidatesSection
        liveWorkspace={liveWorkspace}
        tradability={tradability}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />

      <CandidateDetailSection candidate={selected} />

      <ActiveWatchesSection />
    </div>
  );
}
