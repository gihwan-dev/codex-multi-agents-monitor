import { useEffect, useRef } from "react";
import type { DrawerTab } from "../../../entities/run";
import { useWorkspaceIdentityOverrides } from "../../../features/workspace-identity";
import { LoadingStateBlock, Panel } from "../../../shared/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/primitives";
import {
  CausalGraphView,
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
    activeSessionFilePath,
    activeFollowLive,
    activeLiveConnection,
    recentIndexReady,
    recentIndexError,
    selectionLoadState,
    selectionLoadingPresentation,
    archivedIndexLoading,
    archivedIndexError,
    rawTabAvailable,
    graphScene,
    inspectorSummary,
    summaryFacts,
    anomalyJumps,
    actions,
  } = useMonitorPageState();
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const shortcutTriggerRef = useRef<HTMLElement | null>(null);
  const previousShortcutOpenRef = useRef(state.shortcutHelpOpen);
  const isCompactViewport = useCompactViewport();
  const workspaceIdentityOverrides = useWorkspaceIdentityOverrides(state.datasets);
  const displayDataset = selectionLoadState ? null : activeDataset;
  const displayRawTabAvailable = displayDataset ? rawTabAvailable : false;
  const chromeDataset = activeDataset;
  const hideGraphChrome = Boolean(selectionLoadState && chromeDataset);

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
  const toggleShortcuts = (target?: HTMLElement | null) => {
    if (!state.shortcutHelpOpen) {
      shortcutTriggerRef.current =
        target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      actions.toggleShortcuts();
      return;
    }

    actions.toggleShortcuts();
  };
  const drawerState = {
    drawerOpen: state.drawerOpen,
    drawerTab: state.drawerTab,
    allowRawImport: state.allowRawImport,
    noRawStorage: state.noRawStorage,
    importText: state.importText,
    exportText: state.exportText,
  };

  useEffect(() => {
    if (previousShortcutOpenRef.current && !state.shortcutHelpOpen) {
      shortcutTriggerRef.current?.focus();
    }
    previousShortcutOpenRef.current = state.shortcutHelpOpen;
  }, [state.shortcutHelpOpen]);

  return (
    <div className="monitor-shell">
      {selectionLoadState ? (
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          {selectionLoadState.announcement}
        </output>
      ) : null}

      <MonitorTopBar
        dataset={chromeDataset}
        followLive={activeFollowLive}
        liveConnection={activeLiveConnection}
        onExport={(target) => {
          drawerTriggerRef.current = target;
          actions.exportDataset(false);
        }}
        onToggleFollowLive={actions.toggleFollowLive}
        onToggleShortcuts={toggleShortcuts}
      />

      <div className={`workspace ${isCompactViewport ? "workspace--stacked" : ""}`.trim()}>
        <aside
          className="workspace__rail"
          aria-label="Run list"
          style={{ width: `calc(${state.railWidth}px + var(--resize-handle-hit-width))` }}
        >
          <div className="workspace__rail-pane">
            <WorkspaceRunTree
              datasets={state.datasets}
              recentIndex={state.recentIndex}
              recentIndexReady={recentIndexReady}
              activeRunId={state.activeRunId}
              onSelectRun={actions.selectRun}
              onSelectRecentRun={actions.selectRecentSession}
              onOpenImport={() => openDrawer("import")}
              searchRef={searchRef}
              workspaceIdentityOverrides={workspaceIdentityOverrides}
              archivedIndex={state.archivedIndex}
              archivedTotal={state.archivedTotal}
              archivedHasMore={state.archivedHasMore}
              archivedIndexLoading={archivedIndexLoading}
              archivedIndexError={archivedIndexError}
              activeArchivedFilePath={activeSessionFilePath}
              archivedSearch={state.archivedSearch}
              archiveSectionOpen={state.archiveSectionOpen}
              onToggleArchiveSection={actions.toggleArchiveSection}
              onArchiveSearch={actions.searchArchive}
              onArchiveLoadMore={() => actions.loadArchiveIndex(true)}
              onArchiveSelect={actions.selectArchivedSession}
            />
            {recentIndexError && !state.recentIndex.length ? (
              <p className="archive-list__error">{recentIndexError}</p>
            ) : null}
          </div>
          <ResizeHandle
            label="Resize run list"
            onDrag={actions.resizeRail}
            onKeyboard={actions.resizeRail}
            position={state.railWidth}
          />
        </aside>

        <main
          className="workspace__main"
          aria-label="Graph canvas"
          aria-busy={Boolean(selectionLoadState)}
        >
          {chromeDataset ? (
            <div
              className={hideGraphChrome ? "pointer-events-none invisible" : undefined}
              aria-hidden={hideGraphChrome || undefined}
            >
              <MonitorSummaryStrip
                facts={summaryFacts}
                activeFocus={inspectorSummary?.title ?? null}
              />
              <MonitorGraphToolbar
                anomalyJumps={anomalyJumps}
                onJump={actions.selectItem}
              />
            </div>
          ) : null}

          {!displayDataset ? (
            <Panel
              panelSlot="graph-panel"
              title={selectionLoadingPresentation?.title ?? "Graph"}
              className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
            >
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6">
                {selectionLoadingPresentation ? (
                  <div className="w-full max-w-xl">
                    <LoadingStateBlock
                      title={selectionLoadingPresentation.title}
                      message={selectionLoadingPresentation.message}
                      phaseLabel={selectionLoadingPresentation.phaseLabel}
                      targetEyebrow={selectionLoadingPresentation.targetEyebrow}
                      targetTitle={selectionLoadingPresentation.targetTitle}
                      targetMeta={selectionLoadingPresentation.targetMeta}
                      skeletonRows={3}
                    />
                  </div>
                ) : (
                  <div className="grid max-w-lg gap-2 text-center text-sm text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">Select a run</p>
                    <p>Select a recent or archived run to inspect.</p>
                  </div>
                )}
              </div>
            </Panel>
          ) : null}

          {displayDataset ? (
            <CausalGraphView
              scene={graphScene}
              onSelect={actions.selectItem}
              followLive={activeFollowLive}
              liveMode={displayDataset.run.liveMode}
              onPauseFollowLive={actions.pauseFollowLive}
            />
          ) : null}

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
            activeDataset={displayDataset}
            rawTabAvailable={displayRawTabAvailable}
            onSetDrawerTab={openDrawer}
            onImport={actions.importPayload}
            onImportTextChange={actions.setImportText}
            onAllowRawChange={actions.setAllowRaw}
            onNoRawChange={actions.setNoRawStorage}
            onCloseDrawer={closeDrawer}
          />
        </main>

        {!isCompactViewport ? (
          <aside
            className="workspace__inspector"
            aria-label="Inspector"
            style={{ width: `calc(${state.inspectorWidth}px + var(--resize-handle-hit-width))` }}
          >
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

      <Dialog
        open={state.shortcutHelpOpen}
        onOpenChange={(open) => {
          if (open !== state.shortcutHelpOpen) {
            toggleShortcuts();
          }
        }}
      >
        <DialogContent
          aria-label="Keyboard shortcuts"
          className="max-w-[22rem] border-white/10 bg-[linear-gradient(180deg,rgba(20,24,33,0.98),rgba(17,21,30,0.98))] text-foreground"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            shortcutTriggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Shortcut help</DialogTitle>
            <DialogDescription>
              Keep the graph flow in view without leaving the keyboard.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2 pl-5 text-sm text-muted-foreground">
            <li>`/` search focus</li>
            <li>`I` inspector toggle</li>
            <li>`.` follow live</li>
            <li>`?` shortcuts help</li>
            <li>`Cmd/Ctrl + K` shortcuts help</li>
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => toggleShortcuts()}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
