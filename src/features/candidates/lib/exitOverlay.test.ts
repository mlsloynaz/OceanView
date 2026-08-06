import { describe, expect, it } from "vitest";
import { applyExitCheckToCandidate, exitAwareReadinessLabel } from "./exitOverlay";
import type { CandidateViewModel } from "../models/CandidateViewModel";
import type { PositionExitCheckResponse } from "@/features/market/api/exit-client";

function baseCandidate(): CandidateViewModel {
  return {
    id: "AAPL|e01",
    symbol: "AAPL",
    direction: "CALL",
    strategyId: "estrategia-01",
    strategyName: "E01",
    readiness: "confirmed",
    qualityPct: 80,
    historicalEdge: null,
    confidence: null,
    marketLean: null,
    biasAgreementCount: 1,
    moveRemainingPct: 0.5,
    projectedOptionGainPct: 12,
    expectedMovePct: 0.5,
    stretchMovePct: 0.8,
    expectedMaePct: 0.3,
    timeToTargetBars: 2,
    exhaustionRisk: false,
    tradability: "good",
    updatedAt: new Date().toISOString(),
    supportingReasons: [],
    conflictReasons: [],
    confirmationItems: [],
    source: "market",
    movementProfile: null,
    rankScore: 1,
    rankComponents: {
      setupQuality: 80,
      historicalEdge: 0,
      readiness: 1,
      movementRoom: 1,
      tradability: 1,
      dataQuality: 1,
    },
  };
}

describe("applyExitCheckToCandidate", () => {
  it("sets Exit suggested status when exitSuggested", () => {
    const result: PositionExitCheckResponse = {
      symbol: "AAPL",
      direction: "CALL",
      exitSuggested: true,
      severity: "exit_suggested",
      warnings: [
        {
          code: "bias_against_trade",
          severity: "exit_suggested",
          title: "Bias against trade",
          detail: "prior bajista",
        },
      ],
    };
    const next = applyExitCheckToCandidate(baseCandidate(), result);
    expect(next.readiness).toBe("weakening");
    expect(exitAwareReadinessLabel(next)).toBe("Exit suggested");
    expect(next.exitMonitor?.exitSuggested).toBe(true);
  });

  it("sets Exit watch on warn without exitSuggested", () => {
    const result: PositionExitCheckResponse = {
      symbol: "AAPL",
      direction: "CALL",
      exitSuggested: false,
      severity: "warn",
      warnings: [
        {
          code: "obstacle_blocks_path",
          severity: "warn",
          title: "Obstacle",
          detail: "MA20 near",
        },
      ],
    };
    const next = applyExitCheckToCandidate(baseCandidate(), result);
    expect(next.readiness).toBe("weakening");
    expect(exitAwareReadinessLabel(next)).toBe("Exit watch");
  });

  it("leaves readiness when only info", () => {
    const result: PositionExitCheckResponse = {
      symbol: "AAPL",
      direction: "CALL",
      exitSuggested: false,
      severity: "info",
      warnings: [
        {
          code: "bias_supports_trade",
          severity: "info",
          title: "Bias supports",
          detail: "ok",
        },
      ],
    };
    const next = applyExitCheckToCandidate(baseCandidate(), result);
    expect(next.readiness).toBe("confirmed");
    expect(exitAwareReadinessLabel(next)).toBe("");
  });
});
