import { useEffect, useId, useState } from "react";
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

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    "block w-full rounded-md px-3 py-2.5 text-left text-sm font-semibold tracking-wide transition-colors",
    isActive
      ? "bg-ocean-teal text-ocean-deep"
      : "text-ocean-sand hover:bg-ocean-mid/50 hover:text-ocean-foam",
  );
}

export function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { authRequired, username, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  const visibleNavItems = primaryNav.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  function isItemActive(item: (typeof primaryNav)[number]): boolean {
    return item.match === "/strategies"
      ? pathname === "/strategies" || pathname.startsWith("/strategies/")
      : pathname.startsWith(item.match);
  }

  return (
    <header className="shrink-0 border-b border-ocean-mid/60 bg-ocean-surface/90 backdrop-blur-sm">
      <div className="flex h-12 items-center gap-3 px-3 sm:gap-6 sm:px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden
            className="h-7 w-7 shrink-0"
          />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-ocean-teal">OceanView</span>
            <span className="hidden text-xs uppercase tracking-widest text-ocean-sand/60 sm:inline">
              market intelligence
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() => navClass({ isActive: isItemActive(item) })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {authRequired && username ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-ocean-sand/70 lg:inline">{username}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-ocean-mid/50 px-2.5 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/40 sm:px-3"
              >
                Sign out
              </button>
            </div>
          ) : null}
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-ocean-mid/50 px-2.5 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/40 md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id={menuId}
          className="border-t border-ocean-mid/40 px-3 py-2 md:hidden"
          aria-label="Main navigation"
        >
          <ul className="flex flex-col gap-0.5">
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={() => mobileNavClass({ isActive: isItemActive(item) })}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
