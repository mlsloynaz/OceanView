import { useEffect } from "react";
import { isAuthConfigured } from "@/shared/auth/cognito-config";
import { postPresenceHeartbeat } from "./api/presence-client";

const HEARTBEAT_MS = 45_000;

/** Keep this Cognito session visible on System → connected users. */
export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isAuthConfigured()) return;

    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      void postPresenceHeartbeat().catch(() => {});
    };

    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
