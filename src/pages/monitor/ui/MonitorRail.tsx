import { ResizeHandle } from "../../../widgets/monitor-chrome";
import { WorkspaceRunTree } from "../../../widgets/workspace-run-tree";
import type { MonitorPageView } from "./monitorPageViewTypes";

function MonitorRailError({
  recentIndexError,
}: {
  recentIndexError: string | null;
}) {
  return recentIndexError ? (
    <p className="archive-list__error">{recentIndexError}</p>
  ) : null;
}

function MonitorRailTree(view: MonitorPageView) {
  return (
    <WorkspaceRunTree
      datasets={view.state.datasets}
      recentIndex={view.state.recentIndex}
      recentIndexReady={view.recentIndexReady}
      activeRunId={view.state.activeRunId}
      onSelectRun={view.actions.selectRun}
      onSelectRecentRun={view.actions.selectRecentSession}
      onOpenImport={() => view.openDrawer("import")}
      searchRef={view.searchRef}
      workspaceIdentityOverrides={view.workspaceIdentityOverrides}
      archivedIndex={view.state.archivedIndex}
      archivedTotal={view.state.archivedTotal}
      archivedHasMore={view.state.archivedHasMore}
      archivedIndexLoading={view.archivedIndexLoading}
      archivedIndexError={view.archivedIndexError}
      activeArchivedFilePath={view.activeSessionFilePath}
      archivedSearch={view.state.archivedSearch}
      archiveSectionOpen={view.state.archiveSectionOpen}
      onToggleArchiveSection={view.actions.toggleArchiveSection}
      onArchiveSearch={view.actions.searchArchive}
      onArchiveLoadMore={() => view.actions.loadArchiveIndex(true)}
      onArchiveSelect={view.actions.selectArchivedSession}
    />
  );
}

export function MonitorRail(view: MonitorPageView) {
  return (
    <aside
      className="workspace__rail"
      aria-label="Run list"
      style={{ width: `calc(${view.state.railWidth}px + var(--resize-handle-hit-width))` }}
    >
      <div className="workspace__rail-pane">
        <MonitorRailTree {...view} />
        {view.recentIndexError && !view.state.recentIndex.length ? (
          <MonitorRailError recentIndexError={view.recentIndexError} />
        ) : null}
      </div>
      <ResizeHandle
        label="Resize run list"
        onDrag={view.actions.resizeRail}
        onKeyboard={view.actions.resizeRail}
        position={view.state.railWidth}
      />
    </aside>
  );
}
