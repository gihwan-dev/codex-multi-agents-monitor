import { BottleneckRanking } from "@/features/overview/ui/bottleneck-ranking";
import { LiveThreadCard } from "@/features/overview/ui/live-thread-card";
import { OverviewFilterPanel } from "@/features/overview/ui/overview-filter-panel";
import type { LiveOverviewThread } from "@/shared/types/contracts";

type LiveOverviewContentProps = {
  workspaceFilter: string;
  roleFilter: string;
  severityFilter: string;
  workspaceOptions: string[];
  roleOptions: string[];
  filteredThreads: LiveOverviewThread[];
  bottleneckThreads: LiveOverviewThread[];
  onWorkspaceFilterChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onSeverityFilterChange: (value: string) => void;
};

export function LiveOverviewContent({
  workspaceFilter,
  roleFilter,
  severityFilter,
  workspaceOptions,
  roleOptions,
  filteredThreads,
  bottleneckThreads,
  onWorkspaceFilterChange,
  onRoleFilterChange,
  onSeverityFilterChange,
}: LiveOverviewContentProps) {
  return (
    <>
      <OverviewFilterPanel
        workspaceFilter={workspaceFilter}
        roleFilter={roleFilter}
        severityFilter={severityFilter}
        workspaceOptions={workspaceOptions}
        roleOptions={roleOptions}
        onWorkspaceFilterChange={onWorkspaceFilterChange}
        onRoleFilterChange={onRoleFilterChange}
        onSeverityFilterChange={onSeverityFilterChange}
      />
      <BottleneckRanking threads={bottleneckThreads} />

      {filteredThreads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center text-sm text-[hsl(var(--muted))]">
          현재 필터와 일치하는 현재 대화 thread가 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredThreads.map((thread) => (
            <LiveThreadCard key={thread.thread_id} thread={thread} />
          ))}
        </ul>
      )}
    </>
  );
}
