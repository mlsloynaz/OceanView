import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMarketAlarms } from "@/features/market/alarm/useMarketAlarms";
import { useMarketWorkspace } from "@/features/market/hooks/useMarketWorkspace";
import { ActiveWatchesSection } from "./components/ActiveWatchesSection";
import { CandidateDetailSection } from "./components/CandidateDetailSection";
import { MarketContextStrip } from "./components/MarketContextStrip";
import { TodayHeader } from "./components/TodayHeader";
import { TodayModeTabs } from "./components/TodayModeTabs";
import { TopCandidatesSection } from "./components/TopCandidatesSection";
import {
  defaultTodayMode,
  isTodayMode,
  todayPath,
  type TodayMode,
} from "./lib/today-routes";

export function TodayPage() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const alarms = useMarketAlarms();
  const liveWorkspace = useMarketWorkspace("tickers");

  useEffect(() => {
    if (!isTodayMode(modeParam)) {
      navigate(todayPath(defaultTodayMode()), { replace: true });
    }
  }, [modeParam, navigate]);

  const mode: TodayMode = isTodayMode(modeParam) ? modeParam : defaultTodayMode();

  const setMode = (next: TodayMode) => {
    navigate(todayPath(next));
  };

  const candidateCount =
    mode === "live" ? liveWorkspace.filteredTickerCards.length : mode === "preparation" ? 0 : 0;

  return (
    <div className="w-full space-y-4">
      <TodayHeader
        mode={mode}
        activeWatchCount={alarms.runningCount}
        candidateCount={candidateCount}
        onRefresh={
          mode === "live" ? () => void liveWorkspace.refreshResult() : undefined
        }
        refreshPending={mode === "live" ? liveWorkspace.refreshPending : false}
      />

      <TodayModeTabs mode={mode} onChange={setMode} />

      <MarketContextStrip />

      <TopCandidatesSection mode={mode} liveWorkspace={liveWorkspace} />

      <CandidateDetailSection selectedSymbol={liveWorkspace.selectedTicker} />

      <ActiveWatchesSection alarms={alarms} />
    </div>
  );
}
