import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { todayPath, defaultTodayMode } from "@/features/today/lib/today-routes";
import { alarmsPath, defaultAlarmsTab } from "@/features/alarms/lib/alarm-routes";
import { useAuth } from "@/shared/auth/AuthProvider";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { cn } from "@/shared/lib/cn";

const primaryNav = [
  { to: todayPath(defaultTodayMode()), label: "Today", match: "/today", adminOnly: false },
  { to: alarmsPath(defaultAlarmsTab()), label: "Alarms", match: "/alarms", adminOnly: false },
  { to: "/research", label: "Research", match: "/research", adminOnly: true },
  { to: "/strategies", label: "Strategies", match: "/strategies", adminOnly: true },
  { to: "/universe", label: "Universe", match: "/universe", adminOnly: true },
  { to: "/system", label: "System", match: "/system", adminOnly: true },
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
  const navigate = useNavigate();
  const { authRequired, username, isAdmin, signOut } = useAuth();

  const visibleNavItems = primaryNav.filter((item) => !item.adminOnly || isAdmin);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="shrink-0 border-b border-ocean-mid/60 bg-ocean-surface/90 backdrop-blur-sm">
      <div className="flex h-12 items-center gap-6 px-4 md:px-5">
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
              market intelligence
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                navClass({
                  isActive:
                    item.match === "/strategies"
                      ? pathname === "/strategies" || pathname.startsWith("/strategies/")
                      : pathname.startsWith(item.match),
                })
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {authRequired && username ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-ocean-sand/70 sm:inline">{username}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-ocean-mid/50 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/40"
              >
                Sign out
              </button>
            </div>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
