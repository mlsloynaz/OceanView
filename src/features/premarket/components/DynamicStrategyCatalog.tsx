import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { formatEntryWindow } from "@/features/market/lib/entry-window";
import type { DynamicStrategy } from "../api/dynamic-strategy-client";
import { normalizeTimeframe } from "../lib/builder-utils";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  strategies: DynamicStrategy[];
  saving: boolean;
  onEdit: (strategy: DynamicStrategy) => void;
  onNew: () => void;
  onToggleActive: (strategy: DynamicStrategy) => void;
  onDelete: (strategy: DynamicStrategy) => void;
  onRename: (strategy: DynamicStrategy) => void;
  onSaveAll?: () => void;
  dirtyIds?: ReadonlySet<string>;
  hasUnsavedChanges?: boolean;
  defaultOpen?: boolean;
  title?: string;
  embedded?: boolean;
};

function StrategyCatalogBody({
  strategies,
  saving,
  onEdit,
  onToggleActive,
  onDelete,
  onRename,
  dirtyIds,
}: Pick<
  Props,
  | "strategies"
  | "saving"
  | "onEdit"
  | "onToggleActive"
  | "onDelete"
  | "onRename"
  | "dirtyIds"
>) {
  if (strategies.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-ocean-mid/40 px-4 py-8 text-center text-sm text-ocean-sand">
        No saved strategies yet. Click <strong className="text-ocean-foam">New</strong> to open
        the strategy builder and save a screen.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {strategies.map((strategy) => {
        const isDirty = dirtyIds?.has(strategy.id) ?? false;

        return (
          <li
            key={strategy.id}
            className={cn(
              "rounded-lg border border-ocean-mid/30 px-3 py-3",
              !strategy.active && "opacity-70",
              isDirty && "border-amber-500/40",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium text-ocean-foam">{strategy.name}</span>
                {strategy.shortName && strategy.shortName !== strategy.name && (
                  <span className="ml-2 text-xs text-ocean-sand">({strategy.shortName})</span>
                )}
                <span
                  className={cn(
                    "ml-2 inline rounded px-1.5 py-px text-[10px] font-medium uppercase",
                    strategy.active
                      ? "bg-ocean-teal/20 text-ocean-teal"
                      : "bg-ocean-mid/40 text-ocean-sand",
                  )}
                >
                  {strategy.active ? "active" : "inactive"}
                </span>
                {isDirty ? (
                  <span className="ml-2 inline rounded px-1.5 py-px text-[10px] font-medium uppercase bg-amber-500/20 text-amber-200">
                    unsaved
                  </span>
                ) : null}
                <p className="mt-1 font-mono text-[10px] text-ocean-sand/90" title="Strategy id">
                  {strategy.id}
                </p>
                {formatEntryWindow(strategy.entryWindow) && (
                  <p className="mt-0.5 text-[10px] text-ocean-sand/90">
                    Entry: {formatEntryWindow(strategy.entryWindow)}
                  </p>
                )}
                {strategy.description && (
                  <p className="mt-1 text-xs text-ocean-sand">{strategy.description}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-ocean-teal hover:underline"
                  disabled={saving}
                  onClick={() => onEdit(strategy)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs text-ocean-teal hover:underline"
                  disabled={saving}
                  title={`Rename id ${strategy.id}`}
                  onClick={() => onRename(strategy)}
                >
                  Rename id
                </button>
                <button
                  type="button"
                  className="text-xs text-ocean-teal hover:underline"
                  disabled={saving}
                  onClick={() => onToggleActive(strategy)}
                >
                  {strategy.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className={cn(
                    BTN,
                    "border border-ocean-danger/40 px-2 py-1 text-ocean-danger hover:bg-ocean-danger/10",
                  )}
                  disabled={saving}
                  title={`Delete strategy ${strategy.id}`}
                  onClick={() => onDelete(strategy)}
                >
                  Delete
                </button>
              </div>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {strategy.rules.map((rule) => (
                <li
                  key={rule.id}
                  className="rounded bg-ocean-mid/30 px-2 py-0.5 text-[10px] text-ocean-sand"
                  title={rule.ruleKey}
                >
                  <span className="block">{rule.label}</span>
                  <span className="mt-0.5 block font-mono text-[9px] text-ocean-sand/45">
                    {rule.ruleKey}
                  </span>
                  {rule.timeframe && (
                    <span className="opacity-70">· {normalizeTimeframe(rule.timeframe)}</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

export function DynamicStrategyCatalog({
  strategies,
  saving,
  onEdit,
  onNew,
  onToggleActive,
  onDelete,
  onRename,
  onSaveAll,
  dirtyIds,
  hasUnsavedChanges = false,
  defaultOpen = false,
  title = "Saved strategies",
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const activeCount = strategies.filter((s) => s.active).length;
  const summary = `${strategies.length} saved · ${activeCount} active`;

  if (embedded) {
    return (
      <StrategyCatalogBody
        strategies={strategies}
        saving={saving}
        onEdit={onEdit}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
        onRename={onRename}
        dirtyIds={dirtyIds}
      />
    );
  }
  return (
    <section className="overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-surface shadow-sm">
      <header
        className={cn(
          "flex items-start justify-between gap-2 bg-ocean-deep/40 px-4 py-3",
          open && "border-b border-ocean-mid/40",
        )}
      >
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
          aria-controls="dynamic-strategies-body"
          onClick={() => setOpen((prev) => !prev)}
        >
          <h2 className="font-display text-lg font-semibold text-ocean-foam">{title}</h2>
          <p className="mt-0.5 text-xs text-ocean-sand">{summary}</p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {onSaveAll ? (
            <button
              type="button"
              className={cn(
                BTN,
                hasUnsavedChanges
                  ? "bg-amber-500 text-ocean-deep hover:brightness-105"
                  : "bg-ocean-mid/50 text-ocean-sand",
              )}
              disabled={saving || !hasUnsavedChanges}
              onClick={(e) => {
                e.stopPropagation();
                onSaveAll();
              }}
            >
              {saving ? "Saving…" : "Save all"}
            </button>
          ) : null}
          <button
            type="button"
            className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
            disabled={saving}
            onClick={(e) => {
              e.stopPropagation();
              onNew();
            }}
          >
            New
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="dynamic-strategies-body"
            onClick={() => setOpen((prev) => !prev)}
            className="rounded-md p-1 text-ocean-sand hover:bg-ocean-mid/30 hover:text-ocean-foam"
          >
            <span className="sr-only">
              {open ? "Collapse saved strategies" : "Expand saved strategies"}
            </span>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="currentColor"
              className={cn("h-5 w-5 transition-transform", open && "rotate-180")}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {open ? (
        <div id="dynamic-strategies-body" className="p-4">
          <StrategyCatalogBody
            strategies={strategies}
            saving={saving}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
            onRename={onRename}
            dirtyIds={dirtyIds}
          />
        </div>
      ) : null}
    </section>
  );
}
