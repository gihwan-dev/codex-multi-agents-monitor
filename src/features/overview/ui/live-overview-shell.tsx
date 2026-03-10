import { SearchX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  filterLiveOverviewThreads,
  getRoleOptions,
  getTopBottleneckThreads,
  getWorkspaceOptions,
} from "@/features/overview/lib/live-overview-selectors";
import { BottleneckRanking } from "@/features/overview/ui/bottleneck-ranking";
import { LiveThreadCard } from "@/features/overview/ui/live-thread-card";
import { OverviewFilterPanel } from "@/features/overview/ui/overview-filter-panel";
import type { LiveOverviewThread } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type LiveOverviewShellProps = {
  threads: LiveOverviewThread[];
  isLoading: boolean;
};

export function LiveOverviewShell({
  threads,
  isLoading,
}: LiveOverviewShellProps) {
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const workspaceOptions = getWorkspaceOptions(threads);
  const roleOptions = getRoleOptions(threads);
  const filteredThreads = filterLiveOverviewThreads(threads, {
    workspace: workspaceFilter,
    role: roleFilter,
    severity: severityFilter,
  });
  const bottleneckThreads = getTopBottleneckThreads(filteredThreads);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Live Overview
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Inflight thread timeline shell
        </h2>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-8 text-sm text-[hsl(var(--muted))]">
          <div className="mb-3 h-2 w-24 animate-pulse rounded bg-[hsl(var(--line-strong))]" />
          live thread snapshot loading...
        </div>
      ) : null}

      {!isLoading && threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center">
          <SearchX className="mx-auto mb-3 text-[hsl(var(--muted))]" />
          <p className="text-sm text-[hsl(var(--muted))]">
            inflight thread가 없습니다. `~/.codex/sessions`가 비어 있어도 앱은
            정상입니다.
          </p>
          <div className="mt-4">
            <Link to="/history">
              <Button variant="ghost" size="sm">
                최근 히스토리 보기
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && threads.length > 0 ? (
        <>
          <OverviewFilterPanel
            workspaceFilter={workspaceFilter}
            roleFilter={roleFilter}
            severityFilter={severityFilter}
            workspaceOptions={workspaceOptions}
            roleOptions={roleOptions}
            onWorkspaceFilterChange={setWorkspaceFilter}
            onRoleFilterChange={setRoleFilter}
            onSeverityFilterChange={setSeverityFilter}
          />
          <BottleneckRanking threads={bottleneckThreads} />

          {filteredThreads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center text-sm text-[hsl(var(--muted))]">
              현재 필터와 일치하는 inflight thread가 없습니다.
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredThreads.map((thread) => (
                <LiveThreadCard key={thread.thread_id} thread={thread} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
