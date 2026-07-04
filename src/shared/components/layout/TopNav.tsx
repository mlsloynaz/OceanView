import { NavLink, useLocation } from "react-router-dom";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { cn } from "@/shared/lib/cn";

const navItems = [
  { to: marketPath(defaultMarketMode()), label: "Market", match: "/market" },
  { to: "/premarket", label: "Premarket", match: "/premarket" },
  { to: "/admin", label: "Admin", match: "/admin" },
] as const;

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-4 py-2 text-sm font-semibold tracking-wide transition-colors",
    isActive
      ? "bg-ocean-teal text-ocean-deep"
      : "text-ocean-sand hover:bg-ocean-mid/50 hover:text-ocean-foam",
  );
}

export function TopNav() {
  const { pathname } = useLocation();

  return (
    <header className="shrink-0 border-b border-ocean-mid/60 bg-ocean-surface/90 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-8 px-6">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden
            className="h-7 w-7 shrink-0"
          />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-ocean-teal">OceanView</span>
            <span className="hidden text-xs uppercase tracking-widest text-ocean-sand/60 sm:inline">
              trading desk
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() => navClass({ isActive: pathname.startsWith(item.match) })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
