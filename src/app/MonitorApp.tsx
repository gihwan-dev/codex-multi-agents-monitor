import { useEffect, useRef } from "react";
import { InspectorPane } from "../features/inspector/InspectorPane";
import { GraphView } from "../features/run-detail/graph/GraphView";
import { MapView } from "../features/run-detail/map/MapView";
import { WaterfallView } from "../features/run-detail/waterfall/WaterfallView";
import { RunListPane } from "../features/run-list/RunListPane";
import {
  type AnomalyJump,
  type EventType,
  formatCurrency,
  formatDuration,
  formatTokens,
  groupRuns,
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
    collapsedGapIds,
    actions,
  } = useMonitorAppState();
  const searchRef = useRef<HTMLInputElement>(null);
  const runGroups = groupRuns(state.datasets);

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

  return (
    <div className="monitor-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Warm Graphite Observatory</p>
          <h1>{activeDataset.run.title}</h1>
          <p className="top-bar__breadcrumb">
            {activeDataset.project.name} / {activeDataset.session.title}
          </p>
        </div>
        <div className="top-bar__controls">
          <StatusChip status={activeDataset.run.status} />
          <span className="env-badge">
            {activeDataset.run.liveMode === "live" ? "Live watch" : "Imported run"}
          </span>
          {activeDataset.run.liveMode === "live" ? (
            <span className={`live-badge live-badge--${activeLiveConnection}`}>
              {activeLiveConnection === "paused" ? "Following paused" : activeLiveConnection}
            </span>
          ) : null}
          <input
            ref={searchRef}
            type="search"
            className="search-input"
            placeholder="Search /"
            value={activeFilters.search}
            onChange={(event) => actions.setFilter("search", event.target.value)}
          />
          <button type="button" className="button" onClick={() => actions.exportDataset(false)}>
            Export
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => actions.setDrawerTab("import", true)}
          >
            Import
          </button>
          <button type="button" className="button button--ghost" onClick={actions.toggleShortcuts}>
            ?
          </button>
        </div>
      </header>

      <div className="workspace">
        <div className="workspace__rail" style={{ width: state.railWidth }}>
          <RunListPane
            groups={runGroups}
            activeRunId={state.activeRunId}
            onSelectRun={actions.selectRun}
          />
          <ResizeHandle
            label="Resize run list"
            onDrag={actions.resizeRail}
            onKeyboard={actions.resizeRail}
            position={state.railWidth}
          />
        </div>

        <main className="workspace__main">
          <Panel className="summary-strip" title="30-second checklist">
            <div className="summary-strip__metrics">
              <MetricPill
                label="Agents"
                value={`${activeDataset.run.summaryMetrics.agentCount}`}
              />
              <MetricPill
                label="Current split"
                value={`${activeDataset.lanes.filter((lane) => lane.laneStatus === "running").length} running`}
              />
              <MetricPill
                label="Longest gap"
                value={formatDuration(activeDataset.run.summaryMetrics.idleTimeMs)}
              />
              <MetricPill
                label="First failure"
                value={`${activeDataset.run.summaryMetrics.errorCount || 0}`}
              />
              <MetricPill
                label="Tokens"
                value={formatTokens(activeDataset.run.summaryMetrics.tokens)}
              />
              <MetricPill
                label="Cost"
                value={formatCurrency(activeDataset.run.summaryMetrics.costUsd)}
              />
            </div>
          </Panel>

          <Panel
            className="jump-bar"
            title="Anomaly jumps"
            actions={
              <div className="mode-tabs">
                {(["graph", "waterfall", "map"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`button ${state.viewMode === mode ? "button--active" : "button--ghost"}`.trim()}
                    onClick={() => actions.setViewMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            }
          >
            <div className="jump-bar__content">
              {anomalyJumps.map((jump) => (
                <JumpButton key={jump.label} jump={jump} onJump={actions.selectItem} />
              ))}
            </div>
          </Panel>

          <Panel title="Filters" className="filters-panel">
            <div className="filters-panel__grid">
              <label>
                Agent
                <select
                  value={activeFilters.agentId ?? ""}
                  onChange={(event) =>
                    actions.setFilter("agentId", event.target.value || null)
                  }
                >
                  <option value="">All lanes</option>
                  {activeDataset.lanes.map((lane) => (
                    <option key={lane.laneId} value={lane.agentId}>
                      {lane.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Event type
                <select
                  value={activeFilters.eventType}
                  onChange={(event) =>
                    actions.setFilter("eventType", event.target.value as EventType | "all")
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
                  checked={activeFilters.errorOnly}
                  onChange={(event) => actions.setFilter("errorOnly", event.target.checked)}
                />
                Error-only
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={activeFollowLive}
                  disabled={activeDataset.run.liveMode !== "live"}
                  onChange={actions.toggleFollowLive}
                />
                Follow live
              </label>
            </div>
          </Panel>

          {state.viewMode === "graph" ? (
            <GraphView
              lanes={laneDisplays}
              edges={activeDataset.edges}
              selectedId={state.selection?.id ?? null}
              onSelect={actions.selectItem}
              expandedGapIds={collapsedGapIds}
              onToggleGap={actions.toggleGap}
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
            onSetDrawerTab={actions.setDrawerTab}
            onImport={actions.importPayload}
            onImportTextChange={actions.setImportText}
            onAllowRawChange={actions.setAllowRaw}
            onNoRawChange={actions.setNoRawStorage}
            onToggleDrawer={actions.toggleDrawer}
          />
        </main>

        <div className="workspace__inspector" style={{ width: state.inspectorWidth }}>
          <ResizeHandle
            label="Resize inspector"
            reverse
            onDrag={actions.resizeInspector}
            onKeyboard={actions.resizeInspector}
            position={state.inspectorWidth}
          />
          <InspectorPane
            selection={selectionDetails}
            activeTab={state.inspectorTab}
            rawEnabled={activeDataset.run.rawIncluded}
            showRawTab={rawTabAvailable}
            onChangeTab={actions.setInspectorTab}
            onTogglePinned={actions.togglePinned}
            pinned={state.inspectorPinned}
            open={state.inspectorOpen}
          />
        </div>
      </div>

      {state.shortcutHelpOpen ? (
        <dialog open className="shortcut-dialog">
          <h2>Shortcut help</h2>
          <ul>
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
  state: ReturnType<typeof useMonitorAppState>["state"];
  activeDataset: ReturnType<typeof useMonitorAppState>["activeDataset"];
  rawTabAvailable: boolean;
  onSetDrawerTab: (tab: "artifacts" | "import" | "raw" | "log", open?: boolean) => void;
  onImport: () => void;
  onImportTextChange: (value: string) => void;
  onAllowRawChange: (value: boolean) => void;
  onNoRawChange: (value: boolean) => void;
  onToggleDrawer: () => void;
}) {
  return (
    <Panel
      title="Bottom drawer"
      className={`drawer ${state.drawerOpen ? "drawer--open" : "drawer--closed"}`.trim()}
      actions={
        <button type="button" className="button button--ghost" onClick={onToggleDrawer}>
          {state.drawerOpen ? "Close" : "Open"}
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
              onClick={() => onSetDrawerTab(tab, true)}
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
          {activeDataset.run.rawIncluded ? JSON.stringify(activeDataset, null, 2) : "Raw payload hidden by default."}
        </pre>
      ) : null}
      {state.drawerTab === "log" ? <pre className="drawer__pre">{state.exportText || "No export generated yet."}</pre> : null}
    </Panel>
  );
}
