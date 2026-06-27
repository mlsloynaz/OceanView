import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/shared/components/layout/AppShell";
import { RouteErrorFallback } from "@/shared/components/RouteErrorFallback";
import { RouteNotFound } from "@/shared/components/RouteNotFound";
import { MarketPage } from "@/features/market/MarketPage";
import { MarketRedirect } from "@/features/market/MarketRedirect";
import { AdminPage } from "@/features/admin/AdminPage";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Navigate to={marketPath(defaultMarketMode())} replace /> },
      { path: "market", element: <MarketRedirect /> },
      { path: "market/:mode", element: <MarketPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "*", element: <RouteNotFound /> },
    ],
  },
]);
