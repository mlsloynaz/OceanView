import { createBrowserRouter, Navigate } from "react-router-dom";
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
import { OperationsPage } from "@/features/operations/OperationsPage";
import { AdminPage } from "@/features/admin/AdminPage";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";

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
      { index: true, element: <Navigate to={marketPath(defaultMarketMode())} replace /> },
      { path: "market", element: <MarketRedirect /> },
      { path: "market/:mode", element: <MarketPage /> },
      { path: "premarket", element: <PremarketPage /> },
      { path: "operations", element: <OperationsPage /> },
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
      { path: "admin", element: <RequireAdmin><AdminPage /></RequireAdmin> },
      { path: "*", element: <RouteNotFound /> },
    ],
  },
]);
