import { SkillActivityGrid, SkillActivityLegend } from "../../../widgets/skill-activity-grid";
import type { useSkillActivityPageView } from "../model/useSkillActivityPageView";
import { SkillActivityToolbar } from "./SkillActivityToolbar";
import { SkillActivityTopBar } from "./SkillActivityTopBar";

type SkillActivityPageView = ReturnType<typeof useSkillActivityPageView>;

export function SkillActivityPageContent(view: SkillActivityPageView) {
  return (
    <div className="grid h-full grid-rows-[auto_auto_auto_1fr] gap-4 overflow-hidden p-4">
      <SkillActivityTopBar onNavigateToMonitor={view.onNavigateToMonitor} />
      <SkillActivityToolbar
        searchQuery={view.state.searchQuery}
        freshnessFilter={view.state.freshnessFilter}
        sourceFilter={view.state.sourceFilter}
        sortField={view.state.sortField}
        scanRange={view.state.scanRange}
        totalCount={view.totalCount}
        visibleCount={view.items.length}
        scanLoading={view.scanLoading}
        onSearchChange={view.setSearch}
        onFreshnessFilterChange={view.setFreshnessFilter}
        onSourceFilterChange={view.setSourceFilter}
        onSortChange={view.setSort}
        onScanRangeChange={view.setScanRange}
      />
      <SkillActivityLegend />
      {view.scanError ? (
        <p className="rounded-[var(--radius-soft)] border border-destructive/40 bg-destructive/5 px-3 py-4 text-sm leading-6 text-destructive">
          {view.scanError}
        </p>
      ) : null}
      <SkillActivityGrid
        items={view.items}
        hasCatalog={view.hasCatalog}
        loading={view.scanLoading}
      />
    </div>
  );
}
