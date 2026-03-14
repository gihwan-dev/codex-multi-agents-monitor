import { useEffect, useRef } from "react";
import { CausalInspectorPane } from "../features/inspector/CausalInspectorPane";
import { TimelineGraphView } from "../features/run-detail/graph/TimelineGraphView";
import { MapView } from "../features/run-detail/map/MapView";
import { WaterfallView } from "../features/run-detail/waterfall/WaterfallView";
import { WorkspaceRunTree } from "../features/run-list/WorkspaceRunTree";
import {
  type AnomalyJump,
  type DrawerTab,
  type EventType,
  formatCurrency,
  formatDuration,
  formatTokens,
} from "../shared/domain";
import { MetricPill, Panel, StatusChip } from "../shared/ui";
import { useMonitorAppState } from "./useMonitorAppState";

const eventFilterOptions: Array<EventType | "all"> = [
  "all",
  "handoff",
  "transfer",
  "tool.finished",
  "llm.finished",
  "error",
];

type MonitorAppState = ReturnType<typeof useMonitorAppState>;
type ActiveDataset = MonitorAppState["activeDataset"];
type ActiveFilters = MonitorAppState["activeFilters"];
type ViewMode = MonitorAppState["state"]["viewMode"];
type LiveConnection = MonitorAppState["activeLiveConnection"];

export function MonitorApp() {
  const {
    state,
    activeDataset,
    activeFilters,
    activeFollowLive,
    activeLiveConnection,
    rawTabAvailable,
    laneDisplays,
    selectionDetails,
    anomalyJumps,
    waterfallSegments,
    mapNodes,
    actions,
  } = useMonitorAppState();
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

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

      <div className="workspace">
        <aside className="workspace__rail" style={{ width: state.railWidth }}>
          <div className="workspace__rail-pane">
            <WorkspaceRunTree
              datasets={state.datasets}
              activeRunId={state.activeRunId}
              onSelectRun={actions.selectRun}
              onOpenImport={() => openDrawer("import")}
              searchRef={searchRef}
            />
          </div>
          <ResizeHandle
            label="Resize run list"
            onDrag={actions.resizeRail}
            onKeyboard={actions.resizeRail}
            position={state.railWidth}
          />
        </aside>

        <main className="workspace__main">
          <SummaryStrip dataset={activeDataset} />
          <GraphToolbar
            dataset={activeDataset}
            filters={activeFilters}
            anomalyJumps={anomalyJumps}
            rawTabAvailable={rawTabAvailable}
            viewMode={state.viewMode}
            onJump={actions.selectItem}
            onOpenDrawer={openDrawer}
            onSetFilter={actions.setFilter}
            onSetViewMode={actions.setViewMode}
          />

          {state.viewMode === "graph" ? (
            <TimelineGraphView
              lanes={laneDisplays}
              edges={activeDataset.edges}
              selectedId={state.selection?.id ?? null}
              onSelect={actions.selectItem}
            />
          ) : null}
          {state.viewMode === "waterfall" ? (
            <WaterfallView segments={waterfallSegments} />
          ) : null}
          {state.viewMode === "map" ? <MapView nodes={mapNodes} /> : null}

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

        <aside className="workspace__inspector" style={{ width: state.inspectorWidth }}>
          <ResizeHandle
            label="Resize inspector"
            reverse
            onDrag={actions.resizeInspector}
            onKeyboard={actions.resizeInspector}
            position={state.inspectorWidth}
          />
          <CausalInspectorPane
            dataset={activeDataset}
            selection={selectionDetails}
            rawEnabled={activeDataset.run.rawIncluded}
            onSelectJump={actions.selectItem}
            onOpenDrawer={(tab) => openDrawer(tab)}
            onTogglePinned={actions.togglePinned}
            pinned={state.inspectorPinned}
            open={state.inspectorOpen}
          />
        </aside>
      </div>

      {state.shortcutHelpOpen ? (
        <dialog open className="shortcut-dialog">
          <h2>Shortcut help</h2>
          <ul>
            <li>`/` search focus</li>
            <li>`G` graph mode</li>
            <li>`W` waterfall mode</li>
            <li>`M` map mode</li>
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
        <p className="eyebrow">Warm Graphite Observatory</p>
        <p className="top-bar__breadcrumb">
          {dataset.project.name} / {dataset.session.title}
        </p>
        <div className="top-bar__title-row">
          <h1>{dataset.run.title}</h1>
          <StatusChip status={dataset.run.status} />
          <span className="env-badge">
            {dataset.run.liveMode === "live" ? "Live watch" : "Imported run"}
          </span>
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
        <button
          type="button"
          className="button"
          onClick={(event) => onExport(event.currentTarget)}
        >
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
  dataset,
}: {
  dataset: ActiveDataset;
}) {
  return (
    <section className="summary-strip summary-strip--compact">
      <div className="summary-strip__heading">
        <p className="summary-strip__eyebrow">30-second checklist</p>
        <strong>Keep the graph centered and elevate only the blocker path.</strong>
      </div>
      <div className="summary-strip__metrics">
        <MetricPill label="Agents" value={`${dataset.run.summaryMetrics.agentCount}`} />
        <MetricPill
          label="Current split"
          value={`${dataset.lanes.filter((lane) => lane.laneStatus === "running").length} running`}
        />
        <MetricPill
          label="Longest gap"
          value={formatDuration(dataset.run.summaryMetrics.idleTimeMs)}
        />
        <MetricPill
          label="First failure"
          value={`${dataset.run.summaryMetrics.errorCount || 0}`}
        />
        <MetricPill
          label="Tokens"
          value={formatTokens(dataset.run.summaryMetrics.tokens)}
        />
        <MetricPill
          label="Cost"
          value={formatCurrency(dataset.run.summaryMetrics.costUsd)}
        />
      </div>
    </section>
  );
}

function GraphToolbar({
  dataset,
  filters,
  anomalyJumps,
  rawTabAvailable,
  viewMode,
  onJump,
  onOpenDrawer,
  onSetFilter,
  onSetViewMode,
}: {
  dataset: ActiveDataset;
  filters: ActiveFilters;
  anomalyJumps: AnomalyJump[];
  rawTabAvailable: boolean;
  viewMode: ViewMode;
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
  onOpenDrawer: (tab: DrawerTab, target?: HTMLElement | null) => void;
  onSetFilter: MonitorAppState["actions"]["setFilter"];
  onSetViewMode: MonitorAppState["actions"]["setViewMode"];
}) {
  return (
    <section className="graph-toolbar">
      <div className="graph-toolbar__row">
        <div className="graph-toolbar__cluster">
          <p className="graph-toolbar__label">Anomaly jumps</p>
          <div className="jump-bar__content">
            {anomalyJumps.map((jump) => (
              <JumpButton key={jump.label} jump={jump} onJump={onJump} />
            ))}
          </div>
        </div>

        <div className="graph-toolbar__cluster graph-toolbar__cluster--modes">
          <p className="graph-toolbar__label">Mode</p>
          <div className="mode-tabs">
            {(["graph", "waterfall", "map"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`button ${viewMode === mode ? "button--active" : "button--ghost"}`.trim()}
                onClick={() => onSetViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="graph-toolbar__cluster graph-toolbar__cluster--drawer">
          <p className="graph-toolbar__label">Drawer</p>
          <div className="graph-toolbar__drawer-actions">
            <DrawerButton label="Artifacts" tab="artifacts" onOpenDrawer={onOpenDrawer} />
            <DrawerButton label="Log" tab="log" onOpenDrawer={onOpenDrawer} />
            <DrawerButton
              label="Raw"
              tab="raw"
              disabled={!rawTabAvailable}
              onOpenDrawer={onOpenDrawer}
            />
          </div>
        </div>
      </div>

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
                {item}
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
    </section>
  );
}

function DrawerButton({
  label,
  tab,
  disabled = false,
  onOpenDrawer,
}: {
  label: string;
  tab: DrawerTab;
  disabled?: boolean;
  onOpenDrawer: (tab: DrawerTab, target?: HTMLElement | null) => void;
}) {
  return (
    <button
      type="button"
      className="button button--ghost"
      disabled={disabled}
      onClick={(event) => onOpenDrawer(tab, event.currentTarget)}
    >
      {label}
    </button>
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
        {(["artifacts", "import", "raw", "log"] as const)
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
            value={state.importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
          <button type="button" className="button" onClick={onImport}>
            Parse and import
          </button>
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
    </Panel>
  );
}
