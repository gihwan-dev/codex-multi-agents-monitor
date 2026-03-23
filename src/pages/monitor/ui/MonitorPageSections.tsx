import { LoadingStateBlock, Panel } from "../../../shared/ui";
import { CausalGraphView } from "../../../widgets/causal-graph";
import { CausalInspectorPane } from "../../../widgets/causal-inspector";
import {
  MonitorGraphToolbar,
  MonitorSummaryStrip,
  MonitorTopBar,
  ResizeHandle,
} from "../../../widgets/monitor-chrome";
import { MonitorDrawer } from "../../../widgets/monitor-drawer";
import { WorkspaceRunTree } from "../../../widgets/workspace-run-tree";
import type { useMonitorPageView } from "./useMonitorPageView";

type MonitorPageView = ReturnType<typeof useMonitorPageView>;

function EmptyGraphState({
  selectionLoadingPresentation,
}: Pick<MonitorPageView, "selectionLoadingPresentation">) {
  return (
    <Panel panelSlot="graph-panel" title={selectionLoadingPresentation?.title ?? "Graph"} className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-4 py-6">
        {selectionLoadingPresentation ? (
          <div className="w-full max-w-xl">
            <LoadingStateBlock title={selectionLoadingPresentation.title} message={selectionLoadingPresentation.message} phaseLabel={selectionLoadingPresentation.phaseLabel} targetEyebrow={selectionLoadingPresentation.targetEyebrow} targetTitle={selectionLoadingPresentation.targetTitle} targetMeta={selectionLoadingPresentation.targetMeta} skeletonRows={3} />
          </div>
        ) : (
          <div className="grid max-w-lg gap-2 text-center text-sm text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Select a run</p>
            <p>Select a recent or archived run to inspect.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function MonitorRail({ actions, recentIndexError, searchRef, state, ...view }: MonitorPageView) {
  return <MonitorRailShell actions={actions} recentIndexError={recentIndexError} searchRef={searchRef} state={state} {...view} />;
}

function MonitorRailShell({ actions, recentIndexError, searchRef, state, ...view }: MonitorPageView) {
  return (
    <aside
      className="workspace__rail"
      aria-label="Run list"
      style={{ width: `calc(${state.railWidth}px + var(--resize-handle-hit-width))` }}
    >
      <MonitorRailContent
        actions={actions}
        recentIndexError={recentIndexError}
        searchRef={searchRef}
        state={state}
        {...view}
      />
      <ResizeHandle
        label="Resize run list"
        onDrag={actions.resizeRail}
        onKeyboard={actions.resizeRail}
        position={state.railWidth}
      />
    </aside>
  );
}

function MonitorRailContent({ actions, recentIndexError, searchRef, state, ...view }: MonitorPageView) {
  const workspaceTreeProps = {
    datasets: state.datasets,
    recentIndex: state.recentIndex,
    recentIndexReady: view.recentIndexReady,
    activeRunId: state.activeRunId,
    onSelectRun: actions.selectRun,
    onSelectRecentRun: actions.selectRecentSession,
    onOpenImport: () => view.openDrawer("import"),
    searchRef,
    workspaceIdentityOverrides: view.workspaceIdentityOverrides,
    archivedIndex: state.archivedIndex,
    archivedTotal: state.archivedTotal,
    archivedHasMore: state.archivedHasMore,
    archivedIndexLoading: view.archivedIndexLoading,
    archivedIndexError: view.archivedIndexError,
    activeArchivedFilePath: view.activeSessionFilePath,
    archivedSearch: state.archivedSearch,
    archiveSectionOpen: state.archiveSectionOpen,
    onToggleArchiveSection: actions.toggleArchiveSection,
    onArchiveSearch: actions.searchArchive,
    onArchiveLoadMore: () => actions.loadArchiveIndex(true),
    onArchiveSelect: actions.selectArchivedSession,
  };

  return (
    <div className="workspace__rail-pane">
      <WorkspaceRunTree {...workspaceTreeProps} />
      <MonitorRailErrorMessage recentIndexError={recentIndexError} hasRecentItems={state.recentIndex.length > 0} />
    </div>
  );
}

function MonitorRailErrorMessage({
  hasRecentItems,
  recentIndexError,
}: {
  hasRecentItems: boolean;
  recentIndexError: string | null;
}) {
  return recentIndexError && !hasRecentItems ? <p className="archive-list__error">{recentIndexError}</p> : null;
}

function GraphChrome(view: MonitorPageView) {
  if (!view.chromeState) {
    return null;
  }

  return (
    <div
      className={view.hideGraphChrome ? "pointer-events-none invisible" : undefined}
      aria-hidden={view.hideGraphChrome || undefined}
    >
      <MonitorSummaryStrip
        facts={view.chromeState.summaryFacts}
        activeFocus={view.chromeState.inspectorTitle}
      />
      <MonitorGraphToolbar
        anomalyJumps={view.chromeState.anomalyJumps}
        onJump={view.actions.navigateToItem}
      />
    </div>
  );
}

function GraphContent(view: MonitorPageView) {
  if (!view.displayDataset) {
    return <EmptyGraphState selectionLoadingPresentation={view.selectionLoadingPresentation} />;
  }

  return (
    <CausalGraphView
      scene={view.graphScene}
      onSelect={view.actions.selectItem}
      selectionNavigationRequestId={view.state.selectionNavigationRequestId}
      selectionNavigationRunId={view.state.selectionNavigationRunId}
      runTraceId={view.displayDataset.run.traceId}
      selectionRevealTarget={view.selectionRevealTarget}
      followLive={view.activeFollowLive}
      liveMode={view.displayDataset.run.liveMode}
      onPauseFollowLive={view.actions.pauseFollowLive}
    />
  );
}

function CompactInspector(view: MonitorPageView) {
  if (!view.isCompactViewport) {
    return null;
  }

  return (
    <CausalInspectorPane
      compact
      summary={view.inspectorSummary}
      onSelectJump={view.actions.navigateToItem}
      onOpenDrawer={view.openDrawer}
      onToggleOpen={view.actions.toggleInspector}
      open={view.state.inspectorOpen}
    />
  );
}

function MonitorMain(view: MonitorPageView) {
  const monitorDrawerProps = {
    drawerState: view.drawerState,
    activeDataset: view.displayDataset,
    rawTabAvailable: view.displayRawTabAvailable,
    onSetDrawerTab: view.openDrawer,
    onImport: view.actions.importPayload,
    onImportTextChange: view.actions.setImportText,
    onAllowRawChange: view.actions.setAllowRaw,
    onNoRawChange: view.actions.setNoRawStorage,
    onCloseDrawer: view.closeDrawer,
  };

  return (
    <main
      className="workspace__main"
      aria-label="Graph canvas"
      aria-busy={Boolean(view.selectionLoadState)}
    >
      <GraphChrome {...view} />
      <GraphContent {...view} />
      <CompactInspector {...view} />
      <MonitorDrawer {...monitorDrawerProps} />
    </main>
  );
}

function InspectorRail(view: MonitorPageView) {
  if (view.isCompactViewport) {
    return null;
  }

  return (
    <aside
      className="workspace__inspector"
      aria-label="Inspector"
      style={{
        width: `calc(${view.state.inspectorWidth}px + var(--resize-handle-hit-width))`,
      }}
    >
      <ResizeHandle
        label="Resize inspector"
        reverse
        onDrag={view.actions.resizeInspector}
        onKeyboard={view.actions.resizeInspector}
        position={view.state.inspectorWidth}
      />
      <CausalInspectorPane
        summary={view.inspectorSummary}
        onSelectJump={view.actions.navigateToItem}
        onOpenDrawer={view.openDrawer}
        onToggleOpen={view.actions.toggleInspector}
        open={view.state.inspectorOpen}
      />
    </aside>
  );
}

export function MonitorPageHeader(view: MonitorPageView) {
  return (
    <MonitorTopBar
      dataset={view.chromeState?.dataset ?? null}
      followLive={view.chromeState?.followLive ?? false}
      liveConnection={view.chromeState?.liveConnection ?? "paused"}
      actionsDisabled={Boolean(view.selectionLoadState)}
      onExport={(target) => {
        view.drawerTriggerRef.current = target;
        view.actions.exportDataset(false);
      }}
      onToggleFollowLive={view.actions.toggleFollowLive}
      onToggleShortcuts={view.toggleShortcuts}
    />
  );
}

export function MonitorWorkspace(view: MonitorPageView) {
  return (
    <div className={`workspace ${view.isCompactViewport ? "workspace--stacked" : ""}`.trim()}>
      <MonitorRail {...view} />
      <MonitorMain {...view} />
      <InspectorRail {...view} />
    </div>
  );
}
