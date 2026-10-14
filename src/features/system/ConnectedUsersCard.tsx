import { useCallback, useEffect, useState } from "react";
import { getConnectedUsers, type ConnectedUsersResponse } from "./api/presence-client";

const POLL_MS = 20_000;

function formatLastSeen(iso: string, now = Date.now()): string {
  const seen = Date.parse(iso);
  if (Number.isNaN(seen)) return "";
  const seconds = Math.max(0, Math.round((now - seen) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

export function ConnectedUsersCard() {
  const [data, setData] = useState<ConnectedUsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await getConnectedUsers();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load connected users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const windowMinutes = Math.round((data?.windowSeconds ?? 180) / 60);
  const count = data?.connectedCount ?? 0;

  return (
    <section className="rounded-xl border border-ocean-mid/50 bg-ocean-surface px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ocean-foam">Connected users</h2>
          <p className="mt-1 text-sm text-ocean-sand">
            Cognito sessions with the app open in the last {windowMinutes} minutes.
          </p>
        </div>
        <p className="font-display text-4xl font-semibold tabular-nums text-ocean-teal">
          {loading && !data ? "…" : count}
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!error && data && data.users.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.users.map((user) => (
            <li
              key={user.username}
              className="rounded-full border border-ocean-mid/50 bg-ocean-deep/40 px-3 py-1 text-sm text-ocean-foam"
            >
              {user.username}
              {user.lastSeenAt ? (
                <span className="text-ocean-sand"> · {formatLastSeen(user.lastSeenAt)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!error && !loading && data && data.users.length === 0 ? (
        <p className="mt-3 text-sm text-ocean-sand">No signed-in sessions in this window.</p>
      ) : null}
    </section>
  );
}
