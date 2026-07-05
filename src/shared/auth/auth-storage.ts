const STORAGE_KEY = "oceanview.auth.session";

export type StoredAuthSession = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  username: string;
};

export function loadAuthSession(): StoredAuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed.idToken || !parsed.refreshToken || !parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: StoredAuthSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
