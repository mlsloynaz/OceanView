import { Outlet } from "react-router-dom";
import { AlarmsProvider } from "@/features/alarms/AlarmsProvider";
import { TopNav } from "./TopNav";
import { ToolsPane } from "./ToolsPane";

export function AppShell() {
  return (
    <AlarmsProvider>
      <div className="flex h-screen flex-col">
        <TopNav />

        <div className="flex min-h-0 flex-1">
          <ToolsPane />
          <main className="min-w-0 flex-1 overflow-y-auto p-2 md:p-3">
            <Outlet />
          </main>
        </div>
      </div>
    </AlarmsProvider>
  );
}
