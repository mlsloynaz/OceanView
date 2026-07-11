import { useState, type FormEvent } from "react";
import { cn } from "@/shared/lib/cn";

export type AddTickerFormValues = {
  symbol: string;
  name: string;
  active: boolean;
  isFavorite: boolean;
};

type Props = {
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (values: AddTickerFormValues) => Promise<boolean> | boolean;
};

const INPUT =
  "rounded-md border border-ocean-mid/50 bg-ocean-deep px-2 py-1.5 text-sm text-ocean-foam placeholder:text-ocean-sand/50 focus:border-ocean-teal/60 focus:outline-none disabled:opacity-50";

export function AddTickerForm({ disabled = false, submitting = false, onSubmit }: Props) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = disabled || submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextSymbol = symbol.trim().toUpperCase();
    if (!nextSymbol) {
      setLocalError("Symbol is required.");
      return;
    }
    setLocalError(null);
    const ok = await onSubmit({
      symbol: nextSymbol,
      name: name.trim(),
      active,
      isFavorite,
    });
    if (ok) {
      setSymbol("");
      setName("");
      setActive(true);
      setIsFavorite(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mb-3 space-y-2 rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2.5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ocean-foam">
            Add ticker
          </h3>
          <p className="text-[11px] text-ocean-sand/80">
            Creates a catalog row. Candles still need a refresh for new symbols.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[7rem] flex-col gap-1 text-[11px] text-ocean-sand">
          Symbol
          <input
            value={symbol}
            disabled={busy}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            className={cn(INPUT, "w-28 font-semibold uppercase tracking-wide")}
            required
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[11px] text-ocean-sand">
          Name <span className="font-normal text-ocean-sand/60">(optional)</span>
          <input
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Apple Inc."
            className={cn(INPUT, "w-full")}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs text-ocean-sand">
          <input
            type="checkbox"
            checked={active}
            disabled={busy}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
          />
          Active
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs text-ocean-sand">
          <input
            type="checkbox"
            checked={isFavorite}
            disabled={busy}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
          />
          Favorite
        </label>
        <button
          type="submit"
          disabled={busy || !symbol.trim()}
          className="rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:bg-ocean-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
      {localError ? <p className="text-xs text-ocean-danger">{localError}</p> : null}
    </form>
  );
}
