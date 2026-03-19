import { useEffect, useMemo, useRef, useState } from "react";
import { CausalInspectorPane } from "../features/inspector/CausalInspectorPane";
import { GapDetailSection } from "../features/run-detail/GapDetailSection";
import { CausalGraphView } from "../features/run-detail/graph/CausalGraphView";
import { WorkspaceRunTree } from "../features/run-list/WorkspaceRunTree";
import type {
  DrawerTab,
  EventRecord,
  GraphSceneRow,
  WorkspaceIdentityOverrideMap,
} from "../shared/domain";
import {
  MonitorGraphToolbar,
  MonitorSummaryStrip,
  MonitorTopBar,
  ResizeHandle,
} from "./components/MonitorChrome";
import { MonitorDrawer } from "./components/MonitorDrawer";
import { useMonitorAppState } from "./useMonitorAppState";
import { resolveWorkspaceIdentityOverrides } from "./workspaceIdentityResolver";

export function MonitorApp() {
  const {
    state,
    activeDataset,
    activeFilters,
    activeFollowLive,
    activeLiveConnection,
    archivedLoading,
    rawTabAvailable,
    graphScene,
    inspectorSummary,
    summaryFacts,
    anomalyJumps,
    actions,
  } = useMonitorAppState();
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const [workspaceIdentityOverrides, setWorkspaceIdentityOverrides] =
    useState<WorkspaceIdentityOverrideMap>({});
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 720,
  );

  const activeRows: GraphSceneRow[] = graphScene.rows;

  // collapsedGapIds를 "사용자가 토글한 ID 집합"으로 재해석:
  // 기본 all-collapsed, ID가 집합에 있으면 expanded
  const expandedGapIds = useMemo(() => {
    const toggled = new Set(state.collapsedGapIds[activeDataset.run.traceId] ?? []);
    const set = new Set<string>();
    for (const row of activeRows) {
      if (row.kind === "gap" && toggled.has(row.id)) {
        set.add(row.id);
      }
    }
    return set;
  }, [activeRows, state.collapsedGapIds, activeDataset.run.traceId]);

  const eventsById = useMemo(
    () => new Map(activeDataset.events.map((e) => [e.eventId, e])),
    [activeDataset.events],
  );

  const expandedGaps = useMemo(() => {
    const gaps: Array<{ gapId: string; label: string; hiddenEvents: EventRecord[] }> = [];
    for (const row of activeRows) {
      if (row.kind === "gap" && expandedGapIds.has(row.id)) {
        const hiddenEvents = row.hiddenEventIds
          .map((id) => eventsById.get(id))
          .filter(Boolean) as EventRecord[];
        gaps.push({ gapId: row.id, label: row.label, hiddenEvents });
      }
    }
    return gaps;
  }, [activeRows, expandedGapIds, eventsById]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsCompactViewport(window.innerWidth <= 720);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    resolveWorkspaceIdentityOverrides(state.datasets).then((nextOverrides) => {
      if (!cancelled) {
        setWorkspaceIdentityOverrides(nextOverrides);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [state.datasets]);

  const openDrawer = (tab: DrawerTab, target?: HTMLElement | null) => {
    drawerTriggerRef.current =
      target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    actions.setDrawerTab(tab, true);
  };

  const closeDrawer = () => {
    actions.toggleDrawer();
    window.requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus();
    });
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
              archivedLoading={archivedLoading}
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
              onTogglePinned={actions.togglePinned}
              pinned={state.inspectorPinned}
              open={state.inspectorOpen}
            />
          ) : null}

          <MonitorDrawer
            state={state}
            activeDataset={activeDataset}
            rawTabAvailable={rawTabAvailable}
            onSetDrawerTab={openDrawer}
            onImport={actions.importPayload}
            onImportTextChange={actions.setImportText}
            onAllowRawChange={actions.setAllowRaw}
            onNoRawChange={actions.setNoRawStorage}
            onToggleDrawer={closeDrawer}
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
              onTogglePinned={actions.togglePinned}
              pinned={state.inspectorPinned}
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
            <li>`Cmd/Ctrl + K` help</li>
          </ul>
          <button type="button" className="button" onClick={actions.toggleShortcuts}>
            Close
          </button>
        </dialog>
      ) : null}
    </div>
  );
}
