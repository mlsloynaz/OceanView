import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";

export function LoginPage() {
  const { authRequired, username, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromQuery = searchParams.get("from");
  const from =
    fromQuery ??
    (location.state as { from?: string } | null)?.from ??
    marketPath(defaultMarketMode());

  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authRequired) {
    return <Navigate to={from} replace />;
  }

  if (username) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(user, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ocean-deep px-4">
      <div className="w-full max-w-md rounded-xl border border-ocean-mid/60 bg-ocean-surface p-8 shadow-lg">
        <div className="mb-8 flex items-center gap-3">
          <img src="/favicon.svg" alt="" aria-hidden className="h-9 w-9" />
          <div>
            <h1 className="font-display text-xl font-semibold text-ocean-teal">OceanView</h1>
            <p className="text-sm text-ocean-sand/70">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ocean-sand/80">
              Username
            </span>
            <input
              type="text"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-md border border-ocean-mid/50 bg-ocean-deep/40 px-3 py-2 text-ocean-foam outline-none focus:border-ocean-teal"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ocean-sand/80">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-ocean-mid/50 bg-ocean-deep/40 px-3 py-2 text-ocean-foam outline-none focus:border-ocean-teal"
              required
            />
          </label>

          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-ocean-teal px-4 py-2.5 text-sm font-semibold text-ocean-deep transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
