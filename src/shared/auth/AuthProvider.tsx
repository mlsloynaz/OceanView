import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getStoredUsername, signInWithPassword, signOut as clearSession } from "./cognito-client";
import { isAuthConfigured } from "./cognito-config";
import { loadAuthSession } from "./auth-storage";

type AuthContextValue = {
  authRequired: boolean;
  username: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authRequired = isAuthConfigured();
  const [username, setUsername] = useState<string | null>(() =>
    authRequired ? getStoredUsername() : "dev",
  );
  const [loading, setLoading] = useState(authRequired);

  useEffect(() => {
    if (!authRequired) {
      setLoading(false);
      return;
    }
    const session = loadAuthSession();
    setUsername(session?.username ?? null);
    setLoading(false);
  }, [authRequired]);

  const signIn = useCallback(async (user: string, password: string) => {
    const session = await signInWithPassword(user, password);
    setUsername(session.username);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUsername(null);
  }, []);

  const value = useMemo(
    () => ({
      authRequired,
      username,
      loading,
      signIn,
      signOut,
    }),
    [authRequired, username, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
