import { LiveOverviewContent } from "@/features/overview/ui/live-overview-content";
import { LiveOverviewEmptyState } from "@/features/overview/ui/live-overview-empty-state";
import { LiveOverviewLoadingState } from "@/features/overview/ui/live-overview-loading-state";
import { useLiveOverviewFilters } from "@/features/overview/ui/use-live-overview-filters";
import type { LiveOverviewThread } from "@/shared/types/contracts";

type LiveOverviewShellProps = {
  threads: LiveOverviewThread[];
  isLoading: boolean;
};

export function LiveOverviewShell({
  threads,
  isLoading,
}: LiveOverviewShellProps) {
  const filters = useLiveOverviewFilters(threads);

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

      {isLoading ? <LiveOverviewLoadingState /> : null}

      {!isLoading && threads.length === 0 ? <LiveOverviewEmptyState /> : null}

      {!isLoading && threads.length > 0 ? (
        <LiveOverviewContent
          bottleneckThreads={filters.bottleneckThreads}
          filteredThreads={filters.filteredThreads}
          roleFilter={filters.roleFilter}
          roleOptions={filters.roleOptions}
          severityFilter={filters.severityFilter}
          workspaceFilter={filters.workspaceFilter}
          workspaceOptions={filters.workspaceOptions}
          onRoleFilterChange={filters.setRoleFilter}
          onSeverityFilterChange={filters.setSeverityFilter}
          onWorkspaceFilterChange={filters.setWorkspaceFilter}
        />
      ) : null}
    </section>
  );
}
