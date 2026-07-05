import { cognitoIdpEndpoint, getCognitoConfig, isAuthConfigured } from "./cognito-config";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type StoredAuthSession,
} from "./auth-storage";

type AuthResult = {
  IdToken?: string;
  AccessToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
};

function parseJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split(".")[1];
  if (!segment) return {};
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function usernameFromIdToken(idToken: string): string {
  const payload = parseJwtPayload(idToken);
  const username = payload["cognito:username"] ?? payload.username ?? payload.sub;
  return typeof username === "string" ? username : "user";
}

function groupsFromIdToken(idToken: string): string[] {
  const payload = parseJwtPayload(idToken);
  return parseCognitoGroups(payload["cognito:groups"]);
}

export function parseCognitoGroups(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => part.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }
  if (text.includes(" ")) {
    return text.split(/\s+/).map((part) => part.trim()).filter(Boolean);
  }
  if (text.includes(",")) {
    return text.split(",").map((part) => part.trim()).filter(Boolean);
  }
  return [text];
}

export function isAdminFromIdToken(idToken: string): boolean {
  return groupsFromIdToken(idToken).includes("admin");
}

async function cognitoRequest<T>(target: string, body: Record<string, unknown>): Promise<T> {
  const config = getCognitoConfig();
  if (!config) {
    throw new Error("Cognito is not configured.");
  }
  const response = await fetch(cognitoIdpEndpoint(config.region), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;
    const message =
      typeof record?.message === "string"
        ? record.message
        : typeof record?.__type === "string"
          ? record.__type
          : `Cognito error (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function sessionFromAuthResult(username: string, result: AuthResult): StoredAuthSession {
  const idToken = String(result.IdToken ?? "");
  const accessToken = String(result.AccessToken ?? "");
  const refreshToken = String(result.RefreshToken ?? "");
  if (!idToken || !accessToken) {
    throw new Error("Cognito did not return tokens.");
  }
  const expiresIn = Number(result.ExpiresIn ?? 3600);
  return {
    idToken,
    accessToken,
    refreshToken: refreshToken || loadAuthSession()?.refreshToken || "",
    expiresAt: Date.now() + expiresIn * 1000 - 60_000,
    username: username || usernameFromIdToken(idToken),
  };
}

export async function signInWithPassword(username: string, password: string): Promise<StoredAuthSession> {
  const config = getCognitoConfig();
  if (!config) {
    throw new Error("Cognito is not configured.");
  }
  const response = await cognitoRequest<{
    AuthenticationResult?: AuthResult;
    ChallengeName?: string;
  }>("AWSCognitoIdentityProviderService.InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.clientId,
    AuthParameters: {
      USERNAME: username.trim(),
      PASSWORD: password,
    },
  });
  if (response.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    throw new Error("Password change required — ask an admin to set a permanent password.");
  }
  const result = response.AuthenticationResult;
  if (!result) {
    throw new Error("Sign-in failed.");
  }
  const session = sessionFromAuthResult(username, result);
  saveAuthSession(session);
  return session;
}

async function refreshSession(session: StoredAuthSession): Promise<StoredAuthSession> {
  const config = getCognitoConfig();
  if (!config) {
    throw new Error("Cognito is not configured.");
  }
  if (!session.refreshToken) {
    clearAuthSession();
    throw new Error("Session expired — sign in again.");
  }
  const response = await cognitoRequest<{ AuthenticationResult?: AuthResult }>(
    "AWSCognitoIdentityProviderService.InitiateAuth",
    {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: config.clientId,
      AuthParameters: {
        REFRESH_TOKEN: session.refreshToken,
      },
    },
  );
  const result = response.AuthenticationResult;
  if (!result?.IdToken) {
    clearAuthSession();
    throw new Error("Session expired — sign in again.");
  }
  const next = sessionFromAuthResult(session.username, {
    ...result,
    RefreshToken: result.RefreshToken ?? session.refreshToken,
  });
  saveAuthSession(next);
  return next;
}

export async function getValidIdToken(): Promise<string | null> {
  if (!getCognitoConfig()) {
    return null;
  }
  let session = loadAuthSession();
  if (!session) {
    return null;
  }
  if (Date.now() >= session.expiresAt) {
    session = await refreshSession(session);
  }
  return session.idToken;
}

export function getStoredUsername(): string | null {
  return loadAuthSession()?.username ?? null;
}

export function getStoredIsAdmin(): boolean {
  if (!isAuthConfigured()) {
    return true;
  }
  const session = loadAuthSession();
  if (!session?.idToken) {
    return false;
  }
  return isAdminFromIdToken(session.idToken);
}

export function signOut(): void {
  clearAuthSession();
}
