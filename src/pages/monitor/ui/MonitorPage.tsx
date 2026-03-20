import { useRef } from "react";
import type { DrawerTab } from "../../../entities/run";
import { useWorkspaceIdentityOverrides } from "../../../features/workspace-identity";
import {
  buildExpandedGapIds,
  buildExpandedGaps,
  CausalGraphView,
  GapDetailSection,
} from "../../../widgets/causal-graph";
import { CausalInspectorPane } from "../../../widgets/causal-inspector";
import {
  MonitorGraphToolbar,
  MonitorSummaryStrip,
  MonitorTopBar,
  ResizeHandle,
} from "../../../widgets/monitor-chrome";
import { MonitorDrawer } from "../../../widgets/monitor-drawer";
import { WorkspaceRunTree } from "../../../widgets/workspace-run-tree";
import {
  useCompactViewport,
} from "../lib/useCompactViewport";
import { useSearchFocusShortcut } from "../lib/useSearchFocusShortcut";
import { useMonitorPageState } from "../model/useMonitorPageState";

export function MonitorPage() {
  const {
    state,
    activeDataset,
    activeFilters,
    activeFollowLive,
    activeLiveConnection,
    archivedIndexLoading,
    rawTabAvailable,
    graphScene,
    inspectorSummary,
    summaryFacts,
    anomalyJumps,
    actions,
  } = useMonitorPageState();
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const isCompactViewport = useCompactViewport();
  const workspaceIdentityOverrides = useWorkspaceIdentityOverrides(state.datasets);
  const expandedGapIds = buildExpandedGapIds(
    graphScene.rows,
    state.collapsedGapIds[activeDataset.run.traceId] ?? [],
  );
  const expandedGaps = buildExpandedGaps(
    graphScene.rows,
    expandedGapIds,
    activeDataset.events,
  );

  useSearchFocusShortcut(searchRef);

  const openDrawer = (tab: DrawerTab, target?: HTMLElement | null) => {
    drawerTriggerRef.current =
      target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    actions.setDrawerTab(tab, true);
  };

  const closeDrawer = () => {
    actions.setDrawerOpen(false);
    window.requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus();
    });
  };
  const drawerState = {
    drawerOpen: state.drawerOpen,
    drawerTab: state.drawerTab,
    allowRawImport: state.allowRawImport,
    noRawStorage: state.noRawStorage,
    importText: state.importText,
    exportText: state.exportText,
  };

  return (
    <div className="monitor-shell">
      <MonitorTopBar
        dataset={activeDataset}
        followLive={activeFollowLive}
        liveConnection={activeLiveConnection}
        onExport={(target) => {
          drawerTriggerRef.current = target;
          actions.exportDataset(false);
        }}
        onToggleFollowLive={actions.toggleFollowLive}
        onToggleShortcuts={actions.toggleShortcuts}
      />

      <div className={`workspace ${isCompactViewport ? "workspace--stacked" : ""}`.trim()}>
        <aside className="workspace__rail" aria-label="Run list" style={{ width: state.railWidth }}>
          <div className="workspace__rail-pane">
            <WorkspaceRunTree
              datasets={state.datasets}
              activeRunId={state.activeRunId}
              onSelectRun={actions.selectRun}
              onOpenImport={() => openDrawer("import")}
              searchRef={searchRef}
              workspaceIdentityOverrides={workspaceIdentityOverrides}
              archivedIndex={state.archivedIndex}
              archivedTotal={state.archivedTotal}
              archivedHasMore={state.archivedHasMore}
              archivedIndexLoading={archivedIndexLoading}
              archivedSearch={state.archivedSearch}
              archiveSectionOpen={state.archiveSectionOpen}
              onToggleArchiveSection={actions.toggleArchiveSection}
              onArchiveSearch={actions.searchArchive}
              onArchiveLoadMore={() => actions.loadArchiveIndex(true)}
              onArchiveSelect={actions.selectArchivedSession}
            />
          </div>
          <ResizeHandle
            label="Resize run list"
            onDrag={actions.resizeRail}
            onKeyboard={actions.resizeRail}
            position={state.railWidth}
          />
        </aside>

        <main className="workspace__main" aria-label="Graph canvas">
          <MonitorSummaryStrip facts={summaryFacts} activeFocus={inspectorSummary?.title ?? null} />
          <MonitorGraphToolbar
            dataset={activeDataset}
            filters={activeFilters}
            anomalyJumps={anomalyJumps}
            onJump={actions.selectItem}
            onSetFilter={actions.setFilter}
          />

          <CausalGraphView
            scene={graphScene}
            onSelect={actions.selectItem}
            followLive={activeFollowLive}
            liveMode={activeDataset.run.liveMode}
            onPauseFollowLive={actions.pauseFollowLive}
            expandedGapIds={expandedGapIds}
            onToggleGap={actions.toggleGap}
          />

          <GapDetailSection
            expandedGaps={expandedGaps}
            onSelect={actions.selectItem}
            onCollapseGap={actions.toggleGap}
          />

          {isCompactViewport ? (
            <CausalInspectorPane
              compact
              summary={inspectorSummary}
              onSelectJump={actions.selectItem}
              onOpenDrawer={(tab) => openDrawer(tab)}
              onToggleOpen={actions.toggleInspector}
              open={state.inspectorOpen}
            />
          ) : null}

          <MonitorDrawer
            drawerState={drawerState}
            activeDataset={activeDataset}
            rawTabAvailable={rawTabAvailable}
            onSetDrawerTab={openDrawer}
            onImport={actions.importPayload}
            onImportTextChange={actions.setImportText}
            onAllowRawChange={actions.setAllowRaw}
            onNoRawChange={actions.setNoRawStorage}
            onCloseDrawer={closeDrawer}
          />
        </main>

        {!isCompactViewport ? (
          <aside className="workspace__inspector" aria-label="Inspector" style={{ width: state.inspectorWidth }}>
            <ResizeHandle
              label="Resize inspector"
              reverse
              onDrag={actions.resizeInspector}
              onKeyboard={actions.resizeInspector}
              position={state.inspectorWidth}
            />
            <CausalInspectorPane
              summary={inspectorSummary}
              onSelectJump={actions.selectItem}
              onOpenDrawer={(tab) => openDrawer(tab)}
              onToggleOpen={actions.toggleInspector}
              open={state.inspectorOpen}
            />
          </aside>
        ) : null}
      </div>

      {state.shortcutHelpOpen ? (
        <dialog open aria-modal="true" aria-label="Keyboard shortcuts" className="shortcut-dialog">
          <h2>Shortcut help</h2>
          <ul>
            <li>`/` search focus</li>
            <li>`I` inspector toggle</li>
            <li>`.` follow live</li>
            <li>`E` error only</li>
            <li>`?` shortcuts help</li>
            <li>`Cmd/Ctrl + K` shortcuts help</li>
          </ul>
          <button type="button" className="button" onClick={actions.toggleShortcuts}>
            Close
          </button>
        </dialog>
      ) : null}
    </div>
  );
}
