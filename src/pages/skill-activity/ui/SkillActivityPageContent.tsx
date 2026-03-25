import { SkillActivityGrid } from "../../../widgets/skill-activity-grid";
import type { useSkillActivityPageView } from "../model/useSkillActivityPageView";
import { SkillActivityToolbar } from "./SkillActivityToolbar";
import { SkillActivityTopBar } from "./SkillActivityTopBar";

type SkillActivityPageView = ReturnType<typeof useSkillActivityPageView>;

export function SkillActivityPageContent(view: SkillActivityPageView) {
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr] gap-4 overflow-hidden p-4">
      <SkillActivityTopBar onNavigateToMonitor={view.onNavigateToMonitor} />
      <SkillActivityToolbar
        searchQuery={view.state.searchQuery}
        statusFilter={view.state.statusFilter}
        sortField={view.state.sortField}
        scanRange={view.state.scanRange}
        totalCount={view.totalCount}
        visibleCount={view.items.length}
        scanLoading={view.scanLoading}
        onSearchChange={view.setSearch}
        onStatusFilterChange={view.setStatusFilter}
        onSortChange={view.setSort}
        onScanRangeChange={view.setScanRange}
      />
      <SkillActivityGrid
        items={view.items}
        hasCatalog={view.hasCatalog}
        loading={view.scanLoading}
        onSkillClick={view.onSkillClick}
      />
    </div>
  );
}
