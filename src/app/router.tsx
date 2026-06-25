import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/shared/components/layout/AppShell";
import { MarketPage } from "@/features/market/MarketPage";
import { AdminPage } from "@/features/admin/AdminPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/market" replace /> },
      { path: "market", element: <MarketPage /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
]);
