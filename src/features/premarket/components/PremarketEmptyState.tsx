import { Link } from "react-router-dom";

type Props = {
  isAdmin?: boolean;
  threshold?: number;
  hasActiveStrategies?: boolean;
};

export function PremarketEmptyState({
  isAdmin = false,
  hasActiveStrategies = false,
}: Props = {}) {
  return (
    <div className="rounded-xl border border-dashed border-ocean-mid/50 bg-ocean-surface/50 px-6 py-10 text-center">
      <p className="font-display text-lg text-ocean-foam">No evaluate run yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ocean-sand">
        {hasActiveStrategies ? (
          <>
            Click{" "}
            <strong className="text-ocean-teal-dim dark:text-ocean-teal">Evaluate strategies</strong>{" "}
            below. Set quality threshold to <strong className="text-ocean-foam">All (0%)</strong> to
            see every ticker even when rules fail (e.g. volatility still tightening at the open).
          </>
        ) : isAdmin ? (
          <>
            Activate a saved strategy in{" "}
            <Link to="/admin" className="text-ocean-teal hover:underline">
              Admin
            </Link>
            , then click{" "}
            <strong className="text-ocean-teal-dim dark:text-ocean-teal">Evaluate strategies</strong>.
          </>
        ) : (
          <>
            An admin must activate a dynamic strategy before you can run{" "}
            <strong className="text-ocean-teal-dim dark:text-ocean-teal">Evaluate strategies</strong>.
          </>
        )}
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-ocean-sand/80">
        Strategies and rules live in Dynamo. This run does not update Admin candles.
      </p>
    </div>
  );
}
