import { useState } from "react";

/** Company or index mark cut from the watchlist screenshots. Hidden when that symbol has no file. */
export function TickerMark({ symbol, className }: { symbol: string; className?: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <img
      src={`/ticker-icons/${symbol.trim().toUpperCase()}.png`}
      alt=""
      className={className ?? "mr-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full object-contain align-[-2px]"}
      onError={() => setHidden(true)}
    />
  );
}
