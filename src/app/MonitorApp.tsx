import { useEffect, useMemo, useRef, useState } from "react";
import { CausalInspectorPane } from "../features/inspector/CausalInspectorPane";
import { PromptAssemblyView } from "../features/inspector/PromptAssemblyView";
import { GapDetailSection } from "../features/run-detail/GapDetailSection";
import { CausalGraphView } from "../features/run-detail/graph/CausalGraphView";
import { WorkspaceRunTree } from "../features/run-list/WorkspaceRunTree";
import {
  type AnomalyJump,
  type DrawerTab,
  type EventRecord,
  type EventType,
  formatCurrency,
  formatTokens,
  type GraphSceneRow,
  type SummaryFact,
  type WorkspaceIdentityOverrideMap,
} from "../shared/domain";
import { MetricPill, Panel, StatusChip } from "../shared/ui";
import { useMonitorAppState } from "./useMonitorAppState";
import { resolveWorkspaceIdentityOverrides } from "./workspaceIdentityResolver";

const eventFilterOptions: Array<EventType | "all"> = [
  "all",
  "note",
  "user.prompt",
  "tool.finished",
  "llm.finished",
  "error",
  "handoff",
  "transfer",
];

const EVENT_FILTER_LABELS: Record<string, string> = {
  all: "All",
  note: "Messages",
  "user.prompt": "User prompts",
  "tool.finished": "Tool results",
  "llm.finished": "LLM calls",
  error: "Errors",
  handoff: "Handoff",
  transfer: "Transfer",
};

type MonitorAppState = ReturnType<typeof useMonitorAppState>;
type ActiveDataset = MonitorAppState["activeDataset"];
type ActiveFilters = MonitorAppState["activeFilters"];
type LiveConnection = MonitorAppState["activeLiveConnection"];

export function MonitorApp() {
  const {
    state,
    activeDataset,
    activeFilters,
    activeFollowLive,
    activeLiveConnection,
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
      <TopBar
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
              archivedLoading={state.archivedLoading}
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
          <SummaryStrip facts={summaryFacts} activeFocus={inspectorSummary?.title ?? null} />
          <GraphToolbar
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

          <Drawer
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

function TopBar({
  dataset,
  followLive,
  liveConnection,
  onExport,
  onToggleFollowLive,
  onToggleShortcuts,
}: {
  dataset: ActiveDataset;
  followLive: boolean;
  liveConnection: LiveConnection;
  onExport: (target: HTMLElement) => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: () => void;
}) {
  return (
    <header className="top-bar top-bar--compact">
      <div className="top-bar__identity">
        <p className="eyebrow">Graph-first run workbench</p>
        <p className="top-bar__breadcrumb">
          {dataset.project.name} / {dataset.session.title}
        </p>
        <div className="top-bar__title-row">
          <h1>{dataset.run.title}</h1>
          <StatusChip status={dataset.run.status} />
          <span className="env-badge">
            {dataset.run.liveMode === "live" ? "Live watch" : "Imported run"}
          </span>
          {dataset.run.isArchived ? (
            <span className="env-badge env-badge--archived">Archived</span>
          ) : null}
          {dataset.run.liveMode === "live" ? (
            <span className={`live-badge live-badge--${liveConnection}`}>
              {liveConnection === "paused" ? "Following paused" : liveConnection}
            </span>
          ) : null}
        </div>
      </div>

      <div className="top-bar__controls">
        <button
          type="button"
          className={`button ${followLive ? "button--active" : "button--ghost"}`.trim()}
          disabled={dataset.run.liveMode !== "live"}
          onClick={onToggleFollowLive}
        >
          Follow live
        </button>
        <button type="button" className="button" onClick={(event) => onExport(event.currentTarget)}>
          Export
        </button>
        <button type="button" className="button button--ghost" onClick={onToggleShortcuts}>
          Help
        </button>
      </div>
    </header>
  );
}

function SummaryStrip({
  facts,
  activeFocus,
}: {
  facts: SummaryFact[];
  activeFocus: string | null;
}) {
  return (
    <section className="summary-strip summary-strip--inline">
      <span className="summary-strip__focus">
        {activeFocus ?? "No focus"}
      </span>
      {facts.map((fact) => (
        <MetricPill key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </section>
  );
}

function GraphToolbar({
  dataset,
  filters,
  anomalyJumps,
  onJump,
  onSetFilter,
}: {
  dataset: ActiveDataset;
  filters: ActiveFilters;
  anomalyJumps: AnomalyJump[];
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
  onSetFilter: MonitorAppState["actions"]["setFilter"];
}) {
  return (
    <section className="graph-toolbar graph-toolbar--split">
      <div className="graph-toolbar__row graph-toolbar__row--primary">
        <div className="graph-toolbar__cluster graph-toolbar__cluster--jumps">
          <p className="graph-toolbar__label">Anomaly jumps</p>
          <div className="jump-bar__content">
            {anomalyJumps.map((jump) => (
              <JumpButton key={jump.label} jump={jump} onJump={onJump} />
            ))}
          </div>
        </div>

      </div>

      <div className="graph-toolbar__row graph-toolbar__row--secondary">
        <div className="graph-toolbar__cluster graph-toolbar__cluster--filters">
          <p className="graph-toolbar__label">Focus</p>
          <div className="graph-toolbar__filters">
            <label>
              Agent
              <select
                value={filters.agentId ?? ""}
                onChange={(event) => onSetFilter("agentId", event.target.value || null)}
              >
                <option value="">All lanes</option>
                {dataset.lanes.map((lane) => (
                  <option key={lane.laneId} value={lane.agentId}>
                    {lane.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event type
              <select
                value={filters.eventType}
                onChange={(event) =>
                  onSetFilter("eventType", event.target.value as EventType | "all")
                }
              >
                {eventFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {EVENT_FILTER_LABELS[item] ?? item}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filters.errorOnly}
                onChange={(event) => onSetFilter("errorOnly", event.target.checked)}
              />
              Error-only
            </label>
          </div>
        </div>

      </div>
    </section>
  );
}

function JumpButton({
  jump,
  onJump,
}: {
  jump: AnomalyJump;
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
}) {
  return (
    <button
      type="button"
      className={`jump-button jump-button--${jump.emphasis}`}
      onClick={() => onJump(jump.selection)}
    >
      {jump.label}
    </button>
  );
}

function ResizeHandle({
  label,
  reverse = false,
  position,
  onDrag,
  onKeyboard,
}: {
  label: string;
  reverse?: boolean;
  position: number;
  onDrag: (width: number) => void;
  onKeyboard: (width: number) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="resize-handle"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          onKeyboard(position + (reverse ? 16 : -16));
        }
        if (event.key === "ArrowRight") {
          onKeyboard(position + (reverse ? -16 : 16));
        }
      }}
      onPointerDown={(event) => {
        const startX = event.clientX;
        const startWidth = position;
        const handleMove = (moveEvent: PointerEvent) => {
          const delta = moveEvent.clientX - startX;
          onDrag(startWidth + (reverse ? -delta : delta));
        };
        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      }}
    />
  );
}

function Drawer({
  state,
  activeDataset,
  rawTabAvailable,
  onSetDrawerTab,
  onImport,
  onImportTextChange,
  onAllowRawChange,
  onNoRawChange,
  onToggleDrawer,
}: {
  state: MonitorAppState["state"];
  activeDataset: ActiveDataset;
  rawTabAvailable: boolean;
  onSetDrawerTab: (tab: DrawerTab, target?: HTMLElement | null) => void;
  onImport: () => void;
  onImportTextChange: (value: string) => void;
  onAllowRawChange: (value: boolean) => void;
  onNoRawChange: (value: boolean) => void;
  onToggleDrawer: () => void;
}) {
  if (!state.drawerOpen) {
    return <div className="drawer drawer--closed" aria-hidden="true" />;
  }

  return (
    <Panel
      title="Bottom drawer"
      className="drawer drawer--open"
      actions={
        <button type="button" className="button button--ghost" onClick={onToggleDrawer}>
          Close
        </button>
      }
    >
      <div className="tabs">
        {(["artifacts", "import", "context", "raw", "log"] as const)
          .filter((tab) => rawTabAvailable || tab !== "raw")
          .map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tabs__pill ${state.drawerTab === tab ? "tabs__pill--active" : ""}`.trim()}
              onClick={(event) => onSetDrawerTab(tab, event.currentTarget)}
            >
              {tab}
            </button>
          ))}
      </div>
      {state.drawerTab === "artifacts" ? (
        <div className="drawer__body">
          {activeDataset.artifacts.length ? (
            activeDataset.artifacts.map((item) => (
              <article key={item.artifactId} className="artifact-card">
                <strong>{item.title}</strong>
                <p>{item.preview}</p>
              </article>
            ))
          ) : (
            <p className="drawer__empty">No artifacts yet.</p>
          )}
        </div>
      ) : null}
      {state.drawerTab === "import" ? (
        <div className="drawer__body">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={state.allowRawImport}
              onChange={(event) => onAllowRawChange(event.target.checked)}
            />
            Raw opt-in
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={state.noRawStorage}
              onChange={(event) => onNoRawChange(event.target.checked)}
            />
            No raw storage
          </label>
          <textarea
            className="import-textarea"
            aria-label="JSON payload to import"
            value={state.importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
          <button type="button" className="button" onClick={onImport}>
            Parse and import
          </button>
        </div>
      ) : null}
      {state.drawerTab === "context" ? (
        <div className="drawer__body">
          {activeDataset.promptAssembly ? (
            <PromptAssemblyView assembly={activeDataset.promptAssembly} />
          ) : (
            <p className="drawer__empty">No prompt assembly data available.</p>
          )}
        </div>
      ) : null}
      {state.drawerTab === "raw" ? (
        <pre className="drawer__pre">
          {activeDataset.run.rawIncluded
            ? JSON.stringify(activeDataset, null, 2)
            : "Raw payload hidden by default."}
        </pre>
      ) : null}
      {state.drawerTab === "log" ? (
        <pre className="drawer__pre">{state.exportText || "No export generated yet."}</pre>
      ) : null}
      <div className="drawer__footer">
        <span>{formatTokens(activeDataset.run.summaryMetrics.tokens)}</span>
        <span>{formatCurrency(activeDataset.run.summaryMetrics.costUsd)}</span>
      </div>
    </Panel>
  );
}
