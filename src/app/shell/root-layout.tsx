import { Activity, Archive, Radio, Rows3 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

const navItems = [
  {
    to: "/live",
    icon: Radio,
    label: "Live",
  },
  {
    to: "/archive",
    icon: Archive,
    label: "Archive",
  },
  {
    to: "/summary",
    icon: Rows3,
    label: "Summary",
  },
];

export function RootLayout() {
  const selectedThreadId = useThreadUiStore((state) => state.selectedThreadId);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,hsl(var(--accent))_0%,hsl(var(--bg))_45%)] text-[hsl(var(--fg))]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.86)] px-4 py-3 backdrop-blur">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted))]">
              Codex Desktop
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Multi-Agent Monitor
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}>
                {({ isActive }) => (
                  <Button
                    variant={isActive ? "solid" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon size={16} />
                    {label}
                  </Button>
                )}
              </NavLink>
            ))}
          </div>
        </header>
        <main className="flex-1 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.88)] p-4 shadow-[0_14px_40px_hsl(var(--accent)/0.18)] sm:p-6">
          <Outlet />
        </main>
        <footer className="mt-4 flex items-center justify-between rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.72)] px-4 py-2 text-xs text-[hsl(var(--muted))]">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[hsl(var(--ok))]" />
            <span>Session-first shell active</span>
          </div>
          <span
            className={cn("font-mono", selectedThreadId ? "" : "opacity-70")}
          >
            {selectedThreadId
              ? `selected_session=${selectedThreadId}`
              : "selected_session=none"}
          </span>
        </footer>
      </div>
    </div>
  );
}
