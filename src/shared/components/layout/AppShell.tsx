import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { ToolsPane } from "./ToolsPane";

export function AppShell() {
  return (
    <div className="flex h-screen flex-col">
      <TopNav />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
        <ToolsPane />
      </div>
    </div>
  );
}
