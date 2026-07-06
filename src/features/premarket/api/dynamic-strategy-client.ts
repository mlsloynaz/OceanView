import type { PremarketResultResponse } from "../types";
import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

import { MOCK_DYNAMIC_CATALOG, MOCK_DYNAMIC_RULES, nextMockPremarketStart } from "./mock-data";



export type DynamicRuleTemplate = {

  ruleKey: string;

  label: string;

  defaultType?: string;

  timeframe?: string;

  when?: Record<string, unknown>;

};



export type DynamicRulesResponse = {

  rules: DynamicRuleTemplate[];

  count: number;

};



export type RulePathVariant = "" | "CALL" | "PUT";

export type DynamicStrategyRule = {
  id: string;
  ruleKey: string;
  label: string;
  type: string;
  timeframe?: string;
  /** Strategy path (CALL/PUT) when rule key has no _call/_put suffix. */
  pathVariant?: "CALL" | "PUT";
  when?: Record<string, unknown>;
};

export type DynamicStrategy = {
  id: string;
  name: string;
  shortName?: string | null;
  description?: string;
  /** Fallback CALL/PUT for dangers when path cannot be inferred from rules. */
  direction?: "CALL" | "PUT" | null;
  active: boolean;
  rules: DynamicStrategyRule[];
};

export type DynamicStrategyRuleInput = {
  ruleKey: string;
  pathVariant?: "CALL" | "PUT";
};

export type DynamicCatalogResponse = {
  version?: string;
  updatedAt?: string;
  catalogKind?: string;
  description?: string;
  strategies?: DynamicStrategy[];
};

export type CreateDynamicStrategyRequest = {
  name: string;
  shortName?: string;
  description?: string;
  direction?: "CALL" | "PUT" | "";
  active?: boolean;
  ruleKeys?: string[];
  rules?: DynamicStrategyRuleInput[];
};

export type PatchDynamicStrategyRequest = {
  name?: string;
  shortName?: string;
  description?: string;
  direction?: "CALL" | "PUT" | "";
  active?: boolean;
  ruleKeys?: string[];
  rules?: DynamicStrategyRuleInput[];
};

export type DynamicEvaluateRequest = {
  assessmentTimeMode?: import("@/features/market/lib/assessment-time").AssessmentTimeMode;
  simulationTimeEt?: string;
  strategyIds?: string[];
  ruleKeys?: string[];
  rules?: DynamicStrategyRuleInput[];
  direction?: "CALL" | "PUT";
  name?: string;
  saveAs?: { name: string; active?: boolean };
  options?: { signalThresholdPct?: number };
};



const API_BASE = getApiBaseUrl();

const USE_MOCK = import.meta.env.VITE_USE_MOCK_PREMARKET === "true";



export class DynamicStrategyApiError extends Error {

  readonly code: string | undefined;



  constructor(message: string, code?: string) {

    super(message);

    this.name = "DynamicStrategyApiError";

    this.code = code;

  }

}



async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {

  if (!API_BASE) throw new DynamicStrategyApiError("VITE_API_BASE_URL is not set.");

  const response = await apiFetch(path, init);

  const body = await readResponseBody(response);

  if (!response.ok) {

    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;

    const message =

      typeof record?.error === "string"

        ? record.error

        : typeof record?.message === "string"

          ? record.message

          : `HTTP ${response.status}`;

    const code = typeof record?.code === "string" ? record.code : undefined;

    throw new DynamicStrategyApiError(message, code);

  }

  return body as T;

}



export function dynamicStrategiesUseMock(): boolean {

  return USE_MOCK;

}



export function dynamicStrategiesApiBaseUrl(): string | null {

  return API_BASE || null;

}



export async function fetchDynamicCatalog(): Promise<DynamicCatalogResponse> {
  if (USE_MOCK) {
    return MOCK_DYNAMIC_CATALOG;
  }
  return fetchJson("/dynamic-strategies/catalog");
}

export async function fetchDynamicRules(): Promise<DynamicRulesResponse> {
  if (USE_MOCK) {
    return { rules: MOCK_DYNAMIC_RULES, count: MOCK_DYNAMIC_RULES.length };
  }
  return fetchJson("/dynamic-strategies/rules");
}



export async function createDynamicStrategy(

  body: CreateDynamicStrategyRequest,

): Promise<DynamicStrategy> {

  return fetchJson("/dynamic-strategies", {

    method: "POST",

    body: JSON.stringify(body),

  });

}



export async function patchDynamicStrategy(

  strategyId: string,

  body: PatchDynamicStrategyRequest,

): Promise<DynamicStrategy> {

  return fetchJson(`/dynamic-strategies/${encodeURIComponent(strategyId)}`, {

    method: "PATCH",

    body: JSON.stringify(body),

  });

}



export async function deleteDynamicStrategy(strategyId: string): Promise<void> {

  await fetchJson(`/dynamic-strategies/${encodeURIComponent(strategyId)}`, {

    method: "DELETE",

  });

}



/** Premarket evaluate — dynamic strategyIds (default) or ruleKeys (preview). */

export async function postDynamicEvaluate(

  body: DynamicEvaluateRequest = {},

): Promise<PremarketResultResponse> {

  if (USE_MOCK) {

    await new Promise((r) => setTimeout(r, 900));

    return nextMockPremarketStart();

  }

  return fetchJson<PremarketResultResponse>("/dynamic-strategies/evaluate", {

    method: "POST",

    body: JSON.stringify({
      assessmentTimeMode: body.assessmentTimeMode ?? "now",
      ...(body.options ? { options: body.options } : {}),
      ...(body.simulationTimeEt ? { simulationTimeEt: body.simulationTimeEt } : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.ruleKeys ? { ruleKeys: body.ruleKeys } : {}),
      ...(body.rules ? { rules: body.rules } : {}),
      ...(body.strategyIds ? { strategyIds: body.strategyIds } : {}),
      ...(body.direction ? { direction: body.direction } : {}),
      ...(body.saveAs ? { saveAs: body.saveAs } : {}),
    }),

  });

}


