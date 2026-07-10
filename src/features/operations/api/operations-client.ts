import {
  apiFetch,
  errorMessageFromBody,
  getApiBaseUrl,
  readResponseBody,
} from "@/shared/api/api-fetch";
import type {
  BuyOptionRequest,
  BuyOptionResponse,
  ContractType,
  OperationPosition,
  OperationsTicker,
  OptionPickContract,
  OptionPickResult,
  OptionPicksResponse,
  PriceRange,
} from "../types";
import { MOCK_BUY_RESPONSE, MOCK_OPERATIONS_TICKERS, MOCK_OPTION_PICKS } from "./mock-data";

const MOCK_DELAY_MS = 350;
const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_OPERATIONS === "true";

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const response = await apiFetch(path, init);
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(errorMessageFromBody(body, `HTTP ${response.status}`));
  }
  return body as T;
}

function mapRange(raw: unknown): PriceRange | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { low?: unknown; high?: unknown };
  const low = typeof row.low === "number" ? row.low : Number(row.low);
  const high = typeof row.high === "number" ? row.high : Number(row.high);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

function mapPosition(raw: unknown): OperationPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const status = String(row.status ?? "").toLowerCase();
  return {
    symbol: String(row.symbol ?? "").toUpperCase(),
    status,
    contractType: row.contractType != null ? String(row.contractType) : null,
    optionSymbol: row.optionSymbol != null ? String(row.optionSymbol) : null,
    strike: typeof row.strike === "number" ? row.strike : row.strike != null ? Number(row.strike) : null,
    expiration: row.expiration != null ? String(row.expiration) : null,
    quantity:
      typeof row.quantity === "number" ? row.quantity : row.quantity != null ? Number(row.quantity) : null,
    orderId: row.orderId != null ? String(row.orderId) : null,
    orderStatus: row.orderStatus != null ? String(row.orderStatus) : null,
    tradePrice:
      typeof row.tradePrice === "number"
        ? row.tradePrice
        : row.tradePrice != null
          ? Number(row.tradePrice)
          : null,
    boughtAt: row.boughtAt != null ? String(row.boughtAt) : null,
    canBuy: row.canBuy === true || (row.canBuy !== false && status !== "bought" && status !== "pending"),
    canSell: row.canSell === true || status === "bought",
  };
}

function mapTicker(row: Record<string, unknown>): OperationsTicker {
  return {
    symbol: String(row.symbol ?? "").toUpperCase(),
    name: row.name != null ? String(row.name) : null,
    isFavorite: Boolean(row.isFavorite),
    active: row.active !== false,
    isOperationEnable: row.isOperationEnable !== false,
    optimalRange: mapRange(row.optimalRange),
    optimalRangeMinMax: mapRange(row.optimalRangeMinMax),
    optimalRangeAsOf: row.optimalRangeAsOf != null ? String(row.optimalRangeAsOf) : null,
    position: mapPosition(row.position),
  };
}

function mapPick(raw: unknown): OptionPickContract | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const putCall = String(row.putCall ?? "").toUpperCase();
  if (putCall !== "CALL" && putCall !== "PUT") return null;
  return {
    optionSymbol: String(row.optionSymbol ?? ""),
    strike: Number(row.strike),
    bid: row.bid == null ? null : Number(row.bid),
    ask: row.ask == null ? null : Number(row.ask),
    mark: row.mark == null ? null : Number(row.mark),
    delta: row.delta == null ? null : Number(row.delta),
    expiration: String(row.expiration ?? ""),
    dte: Number(row.dte ?? 0),
    putCall,
  };
}

function mapResult(row: Record<string, unknown>): OptionPickResult {
  return {
    symbol: String(row.symbol ?? "").toUpperCase(),
    optimalRange: mapRange(row.optimalRange) ?? { low: 0, high: 0 },
    underlyingPrice: row.underlyingPrice == null ? null : Number(row.underlyingPrice),
    expiration: row.expiration != null ? String(row.expiration) : null,
    dte: row.dte == null ? null : Number(row.dte),
    pick: mapPick(row.pick),
    status: String(row.status ?? "error"),
    message: row.message != null ? String(row.message) : null,
  };
}

export function operationsApiUsesMock(): boolean {
  return USE_MOCK;
}

export function operationsApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function fetchOperationsTickers(): Promise<OperationsTicker[]> {
  if (USE_MOCK) {
    await delay();
    return MOCK_OPERATIONS_TICKERS.map((row) => ({
      ...row,
      position: row.position ? { ...row.position } : null,
    }));
  }
  const payload = await fetchJson<{ tickers?: Record<string, unknown>[] }>("/operations/tickers");
  return (payload.tickers ?? []).map(mapTicker);
}

export async function fetchOptionPicks(
  contractType: ContractType,
  symbols?: string[],
): Promise<OptionPicksResponse> {
  if (USE_MOCK) {
    await delay(700);
    const wanted = new Set((symbols ?? []).map((s) => s.toUpperCase()));
    const results = MOCK_OPTION_PICKS.results
      .filter((row) => wanted.size === 0 || wanted.has(row.symbol))
      .map((row) => ({
        ...row,
        pick: row.pick ? { ...row.pick, putCall: contractType } : null,
      }));
    return {
      contractType,
      evaluatedAt: new Date().toISOString(),
      results,
    };
  }
  const params = new URLSearchParams({ contractType });
  if (symbols?.length) {
    params.set("symbols", symbols.map((s) => s.toUpperCase()).join(","));
  }
  const payload = await fetchJson<Record<string, unknown>>(`/operations/option-picks?${params}`);
  return {
    contractType: (String(payload.contractType ?? contractType).toUpperCase() as ContractType) || contractType,
    evaluatedAt: String(payload.evaluatedAt ?? ""),
    results: Array.isArray(payload.results)
      ? payload.results.map((row) => mapResult(row as Record<string, unknown>))
      : [],
  };
}

export async function postBuyOption(body: BuyOptionRequest): Promise<BuyOptionResponse> {
  if (USE_MOCK) {
    await delay(500);
    return {
      ...MOCK_BUY_RESPONSE,
      symbol: body.symbol.toUpperCase(),
      optionSymbol: body.optionSymbol,
      contractType: body.contractType,
      strike: body.strike ?? MOCK_BUY_RESPONSE.strike,
      expiration: body.expiration ?? MOCK_BUY_RESPONSE.expiration,
      position: MOCK_BUY_RESPONSE.position
        ? { ...MOCK_BUY_RESPONSE.position, symbol: body.symbol.toUpperCase() }
        : null,
    };
  }
  const payload = await fetchJson<Record<string, unknown>>("/operations/buy", {
    method: "POST",
    body: JSON.stringify({
      symbol: body.symbol,
      optionSymbol: body.optionSymbol,
      contractType: body.contractType,
      quantity: body.quantity ?? 1,
      ...(body.strike != null ? { strike: body.strike } : {}),
      ...(body.expiration ? { expiration: body.expiration } : {}),
      ...(body.ask != null ? { ask: body.ask } : {}),
      ...(body.bid != null ? { bid: body.bid } : {}),
      ...(body.mark != null ? { mark: body.mark } : {}),
    }),
  });
  return {
    symbol: String(payload.symbol ?? body.symbol).toUpperCase(),
    contractType: (String(payload.contractType ?? body.contractType).toUpperCase() as ContractType),
    optionSymbol: String(payload.optionSymbol ?? body.optionSymbol),
    quantity: Number(payload.quantity ?? body.quantity ?? 1),
    strike: payload.strike == null ? null : Number(payload.strike),
    expiration: payload.expiration != null ? String(payload.expiration) : null,
    orderId: payload.orderId != null ? String(payload.orderId) : null,
    orderStatus: payload.orderStatus != null ? String(payload.orderStatus) : null,
    tradePrice: payload.tradePrice == null ? null : Number(payload.tradePrice),
    filledQuantity: payload.filledQuantity == null ? null : Number(payload.filledQuantity),
    status: String(payload.status ?? ""),
    message: payload.message != null ? String(payload.message) : null,
    position: mapPosition(payload.position),
    canBuy: payload.canBuy === true,
    canSell: payload.canSell === true,
  };
}
