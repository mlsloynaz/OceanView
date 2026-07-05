import { getValidIdToken, signOut } from "@/shared/auth/cognito-client";
import { isAuthConfigured } from "@/shared/auth/cognito-config";

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
}

function redirectToLogin(): void {
  signOut();
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const loginUrl = returnTo && returnTo !== "/login" ? `/login?from=${encodeURIComponent(returnTo)}` : "/login";
  window.location.assign(loginUrl);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = await getValidIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 401 && isAuthConfigured()) {
    redirectToLogin();
  }
  return response;
}

export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function errorMessageFromBody(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}
