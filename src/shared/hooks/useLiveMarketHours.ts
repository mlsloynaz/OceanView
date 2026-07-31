import { useEffect, useState } from "react";
import { isRegularMarketSessionEt } from "@/features/market/lib/assessment-time";

/**
 * Live assess/evaluate is only allowed during RTH.
 * Outside the regular session, callers should force Simulate and pass ``liveEnabled={false}``.
 */
export function useLiveMarketHours(pollMs = 30_000): {
  marketOpen: boolean;
  liveEnabled: boolean;
} {
  const [marketOpen, setMarketOpen] = useState(() => isRegularMarketSessionEt());

  useEffect(() => {
    const tick = () => setMarketOpen(isRegularMarketSessionEt());
    tick();
    const id = window.setInterval(tick, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs]);

  return { marketOpen, liveEnabled: marketOpen };
}
