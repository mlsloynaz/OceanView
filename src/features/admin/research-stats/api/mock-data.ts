import type { ResearchRuleSelection, ResearchStatsRequest, ResearchStatsResult } from "../types";

function defaultMovement(rule: ResearchRuleSelection) {
  return rule.movement;
}

export function buildMockResearchStatsResult(req: ResearchStatsRequest): ResearchStatsResult {
  const symbol = req.symbol.trim().toUpperCase() || "AAPL";
  const name = req.name.trim() || "Untitled research";
  const hours = [9, 10, 11, 12, 13, 14, 15];

  const rulesSel: ResearchRuleSelection[] =
    req.mode === "rules" && req.rules?.length
      ? req.rules
      : [
          { ruleKey: "bb_mid_cut_1h", movement: "up", trend: "up" },
          { ruleKey: "trendline_break_1h", movement: "up", trend: "up" },
          { ruleKey: "trendline_break_1h", movement: "down", trend: "down" },
        ];

  const ruleKeysForHour =
    req.mode === "rules"
      ? rulesSel
      : [{ ruleKey: "strategy-rules", movement: "up" as const }];

  const rules: ResearchStatsResult["byHour"]["rules"] = [];
  if (req.mode === "rules") {
    for (const hourEt of hours) {
      for (const rule of rulesSel) {
        const evalCount = 18 + (hourEt % 3) * 2;
        const trueCount = Math.max(1, Math.round(evalCount * (0.12 + (hourEt % 5) * 0.04)));
        rules.push({
          hourEt,
          ruleKey: rule.ruleKey,
          movement: defaultMovement(rule),
          trueCount,
          evalCount,
          trueRatePct: Math.round((trueCount / evalCount) * 1000) / 10,
        });
      }
    }
  }

  const strategyId = req.strategyId || "estrategia-01";
  const strategy: ResearchStatsResult["byHour"]["strategy"] =
    req.mode === "strategy"
      ? hours.map((hourEt) => {
          const evalCount = 12;
          const trueCount = hourEt === 10 || hourEt === 14 ? 4 : 1;
          return {
            hourEt,
            strategyId,
            trueCount,
            evalCount,
            trueRatePct: Math.round((trueCount / evalCount) * 1000) / 10,
          };
        })
      : [];

  const upRules = rulesSel.filter((r) => r.movement === "up").map((r) => r.ruleKey);
  const downRules = rulesSel.filter((r) => r.movement === "down").map((r) => r.ruleKey);

  const movements: ResearchStatsResult["movements"] = [
    {
      atEt: `${req.startDate}T10:15:00-04:00`,
      direction: "up",
      hourEt: 10,
      matchedRuleKeys:
        req.mode === "rules" ? upRules.slice(0, 2) : [],
      strategyTrue: req.mode === "strategy" ? true : undefined,
    },
    {
      atEt: `${req.startDate}T14:30:00-04:00`,
      direction: "down",
      hourEt: 14,
      matchedRuleKeys:
        req.mode === "rules"
          ? downRules.length
            ? downRules.slice(0, 1)
            : upRules.slice(0, 1)
          : [],
      strategyTrue: req.mode === "strategy" ? false : undefined,
    },
    {
      atEt: `${req.endDate}T11:00:00-04:00`,
      direction: "up",
      hourEt: 11,
      matchedRuleKeys: req.mode === "rules" ? upRules.slice(0, 1) : [],
      strategyTrue: req.mode === "strategy" ? true : undefined,
    },
  ];

  const byDir = (direction: "up" | "down") => {
    const subset = movements.filter((m) => m.direction === direction);
    const counts = new Map<string, number>();
    for (const m of subset) {
      for (const key of m.matchedRuleKeys) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const movementsTotal = subset.length;
    return {
      direction,
      movementsTotal,
      rules: [...counts.entries()]
        .map(([ruleKey, movementsWithRule]) => ({
          ruleKey,
          movementsWithRule,
          sharePct:
            movementsTotal > 0
              ? Math.round((movementsWithRule / movementsTotal) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.sharePct - a.sharePct),
    };
  };

  void ruleKeysForHour;

  return {
    runId: `research-mock-${Date.now()}`,
    status: "complete",
    message: `Mock research "${name}" complete — prior saved result overwritten.`,
    overwritten: true,
    request: { ...req, name, symbol },
    summary: {
      sessionsEvaluated: hours.length * 5,
      rulesTrueTotal:
        req.mode === "rules" ? rules.reduce((sum, r) => sum + r.trueCount, 0) : null,
      strategyTrueTotal:
        req.mode === "strategy" ? strategy.reduce((sum, r) => sum + r.trueCount, 0) : null,
      movementsUp: movements.filter((m) => m.direction === "up").length,
      movementsDown: movements.filter((m) => m.direction === "down").length,
    },
    byHour: { rules, strategy },
    movements,
    movementCommonality: req.mode === "rules" ? [byDir("up"), byDir("down")] : [],
    savedTo: "OceanView-ResearchRuns#LATEST",
  };
}
