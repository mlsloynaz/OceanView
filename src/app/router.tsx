import { createBrowserRouter, Navigate } from "react-router-dom";
import { AlarmsPage } from "@/features/alarms/AlarmsPage";
import { AlarmsRedirect } from "@/features/alarms/AlarmsRedirect";
import { alarmsPath, defaultAlarmsTab } from "@/features/alarms/lib/alarm-routes";
import { AppShell } from "@/shared/components/layout/AppShell";
import { RouteErrorFallback } from "@/shared/components/RouteErrorFallback";
import { RouteNotFound } from "@/shared/components/RouteNotFound";
import { LoginPage } from "@/shared/auth/LoginPage";
import { RequireAdmin } from "@/shared/auth/RequireAdmin";
import { RequireAuth } from "@/shared/auth/RequireAuth";
import { MarketPage } from "@/features/market/MarketPage";
import { MarketRedirect } from "@/features/market/MarketRedirect";
import { PremarketPage } from "@/features/premarket/PremarketPage";
import { StrategyBuilderPage } from "@/features/premarket/StrategyBuilderPage";
import { AdminPage } from "@/features/admin/AdminPage";
import { ResearchPage } from "@/features/research/ResearchPage";
import { StrategiesHubPage } from "@/features/strategies/StrategiesHubPage";
import { UniversePage } from "@/features/universe/UniversePage";
import { SystemPage } from "@/features/system/SystemPage";
import { TodayPage } from "@/features/today/TodayPage";
import { TodayRedirect } from "@/features/today/TodayRedirect";
import { todayPath, defaultTodayMode } from "@/features/today/lib/today-routes";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Navigate to={todayPath(defaultTodayMode())} replace /> },
      { path: "today", element: <TodayRedirect /> },
      { path: "today/:mode", element: <TodayPage /> },
      { path: "alarms", element: <AlarmsRedirect /> },
      { path: "alarms/:tab", element: <AlarmsPage /> },
      {
        path: "research",
        element: (
          <RequireAdmin>
            <ResearchPage />
          </RequireAdmin>
        ),
      },
      {
        path: "strategies",
        element: (
          <RequireAdmin>
            <StrategiesHubPage />
          </RequireAdmin>
        ),
      },
      {
        path: "strategies/new",
        element: (
          <RequireAdmin>
            <StrategyBuilderPage />
          </RequireAdmin>
        ),
      },
      {
        path: "strategies/:strategyId/edit",
        element: (
          <RequireAdmin>
            <StrategyBuilderPage />
          </RequireAdmin>
        ),
      },
      {
        path: "universe",
        element: (
          <RequireAdmin>
            <UniversePage />
          </RequireAdmin>
        ),
      },
      {
        path: "system",
        element: (
          <RequireAdmin>
            <SystemPage />
          </RequireAdmin>
        ),
      },
      // Compatibility routes — preserved; primary nav no longer highlights these
      { path: "market", element: <MarketRedirect /> },
      {
        path: "market/alarm",
        element: <Navigate to={alarmsPath(defaultAlarmsTab())} replace />,
      },
      { path: "market/:mode", element: <MarketPage /> },
      { path: "premarket", element: <PremarketPage /> },
      { path: "admin", element: <RequireAdmin><AdminPage /></RequireAdmin> },
      { path: "*", element: <RouteNotFound /> },
    ],
  },
]);
