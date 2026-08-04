import { apiFetch, errorMessageFromBody, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";
import type { LabE05SaliendoRequest, LabE05SaliendoResult } from "../types-e05-saliendo";
import type { Lab1MonitorResponse, Lab1StartStopAck } from "../types";

const API_BASE = getApiBaseUrl();

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

export async function startLab1Monitor(tickers?: string[]): Promise<Lab1MonitorResponse> {
  return fetchJson<Lab1MonitorResponse>("/lab/lab1/start", {
    method: "POST",
    body: JSON.stringify(tickers?.length ? { tickers } : {}),
  });
}

export async function pollLab1Monitor(monitorId?: string | null): Promise<Lab1MonitorResponse> {
  const qs = monitorId ? `?monitorId=${encodeURIComponent(monitorId)}` : "";
  return fetchJson<Lab1MonitorResponse>(`/lab/lab1/status${qs}`);
}

export async function stopLab1Monitor(monitorId?: string | null): Promise<Lab1StartStopAck> {
  return fetchJson<Lab1StartStopAck>("/lab/lab1/stop", {
    method: "POST",
    body: JSON.stringify(monitorId ? { monitorId } : {}),
  });
}

export async function runLabE05SaliendoResearch(
  request: LabE05SaliendoRequest,
): Promise<LabE05SaliendoResult> {
  return fetchJson<LabE05SaliendoResult>("/lab/research/e05-saliendo/run", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function fetchLabE05SaliendoResult(): Promise<LabE05SaliendoResult> {
  return fetchJson<LabE05SaliendoResult>("/lab/research/e05-saliendo/result");
}
