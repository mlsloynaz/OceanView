import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CandidateViewModel } from "@/features/candidates";
import {
  adaptMarketTickerCards,
  adaptPremarketBestHits,
  sortCandidatesByRank,
  useTradabilityTiers,
} from "@/features/candidates";
import { useMarketAlarms } from "@/features/market/alarm/useMarketAlarms";
import { useMarketWorkspace } from "@/features/market/hooks/useMarketWorkspace";
import {
  filterStrategyGroupsByThreshold,
  resolvePremarketBestHits,
} from "@/features/premarket/display";
import { usePremarketWorkspace } from "@/features/premarket/hooks/usePremarketWorkspace";
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
  const premarketWorkspace = usePremarketWorkspace();
  const tradability = useTradabilityTiers();
  const [selected, setSelected] = useState<CandidateViewModel | null>(null);

  useEffect(() => {
    if (!isTodayMode(modeParam)) {
      navigate(todayPath(defaultTodayMode()), { replace: true });
    }
  }, [modeParam, navigate]);

  const mode: TodayMode = isTodayMode(modeParam) ? modeParam : defaultTodayMode();

  useEffect(() => {
    setSelected(null);
  }, [mode]);

  const setMode = (next: TodayMode) => {
    navigate(todayPath(next));
  };

  const liveCandidates = useMemo(() => {
    if (mode !== "live") return [];
    return sortCandidatesByRank(
      adaptMarketTickerCards(liveWorkspace.filteredTickerCards, {
        updatedAt: liveWorkspace.assessmentAt?.toISOString?.() ?? new Date().toISOString(),
        tradabilityBySymbol: tradability.bySymbol,
      }),
    );
  }, [
    mode,
    liveWorkspace.filteredTickerCards,
    liveWorkspace.assessmentAt,
    tradability.bySymbol,
  ]);

  const prepCandidates = useMemo(() => {
    if (mode !== "preparation") return [];
    const raw = premarketWorkspace.result?.strategies ?? [];
    const threshold = premarketWorkspace.thresholdInput;
    const hits = resolvePremarketBestHits(
      filterStrategyGroupsByThreshold(raw, threshold),
      premarketWorkspace.result?.bestResults,
      10,
      threshold,
    );
    return sortCandidatesByRank(
      adaptPremarketBestHits(hits, {
        updatedAt: premarketWorkspace.result?.evaluatedAt ?? new Date().toISOString(),
        tradabilityBySymbol: tradability.bySymbol,
      }),
    );
  }, [
    mode,
    premarketWorkspace.result?.strategies,
    premarketWorkspace.result?.bestResults,
    premarketWorkspace.result?.evaluatedAt,
    premarketWorkspace.thresholdInput,
    tradability.bySymbol,
  ]);

  const candidateCount =
    mode === "live" ? liveCandidates.length : mode === "preparation" ? prepCandidates.length : 0;

  const handleSelect = (candidate: CandidateViewModel | null) => {
    setSelected(candidate);
  };

  return (
    <div className="w-full space-y-4">
      <TodayHeader
        mode={mode}
        activeWatchCount={alarms.runningCount}
        candidateCount={candidateCount}
        onRefresh={
          mode === "live"
            ? () => {
                void liveWorkspace.refreshResult();
                void tradability.refresh();
              }
            : mode === "preparation"
              ? () => {
                  void premarketWorkspace.refreshResult();
                  void tradability.refresh();
                }
              : () => void tradability.refresh()
        }
        refreshPending={
          mode === "live"
            ? liveWorkspace.refreshPending || tradability.loading
            : mode === "preparation"
              ? premarketWorkspace.loading || tradability.loading
              : tradability.loading
        }
      />

      <TodayModeTabs mode={mode} onChange={setMode} />

      <MarketContextStrip />

      <TopCandidatesSection
        mode={mode}
        liveWorkspace={liveWorkspace}
        premarketWorkspace={premarketWorkspace}
        tradability={tradability}
        selectedId={selected?.id ?? null}
        onSelect={handleSelect}
      />

      <CandidateDetailSection candidate={selected} />

      <ActiveWatchesSection alarms={alarms} />
    </div>
  );
}
