import type {
  AnomalyJump,
  EventType,
  RunDataset,
  RunFilters,
  SummaryFact,
} from "../../shared/domain";
import { MetricPill, StatusChip } from "../../shared/ui";
import type { LiveConnection } from "../useMonitorAppState";

const EVENT_FILTER_OPTIONS = [
  "all",
  "note",
  "user.prompt",
  "tool.finished",
  "llm.finished",
  "error",
  "handoff",
  "transfer",
 ] as const satisfies ReadonlyArray<EventType | "all">;

type EventFilterOption = (typeof EVENT_FILTER_OPTIONS)[number];

const EVENT_FILTER_LABELS: Record<EventFilterOption, string> = {
  all: "All",
  note: "Messages",
  "user.prompt": "User prompts",
  "tool.finished": "Tool results",
  "llm.finished": "LLM calls",
  error: "Errors",
  handoff: "Handoff",
  transfer: "Transfer",
};

interface MonitorTopBarProps {
  dataset: RunDataset;
  followLive: boolean;
  liveConnection: LiveConnection;
  onExport: (target: HTMLElement) => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: () => void;
}

export function MonitorTopBar({
  dataset,
  followLive,
  liveConnection,
  onExport,
  onToggleFollowLive,
  onToggleShortcuts,
}: MonitorTopBarProps) {
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

interface MonitorSummaryStripProps {
  facts: SummaryFact[];
  activeFocus: string | null;
}

export function MonitorSummaryStrip({
  facts,
  activeFocus,
}: MonitorSummaryStripProps) {
  return (
    <section className="summary-strip summary-strip--inline">
      <span className="summary-strip__focus">{activeFocus ?? "No focus"}</span>
      {facts.map((fact) => (
        <MetricPill key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </section>
  );
}

interface MonitorGraphToolbarProps {
  dataset: RunDataset;
  filters: RunFilters;
  anomalyJumps: AnomalyJump[];
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
  onSetFilter: (key: keyof RunFilters, value: string | boolean | null) => void;
}

export function MonitorGraphToolbar({
  dataset,
  filters,
  anomalyJumps,
  onJump,
  onSetFilter,
}: MonitorGraphToolbarProps) {
  return (
    <section className="graph-toolbar graph-toolbar--split">
      <div className="graph-toolbar__row graph-toolbar__row--primary">
        <div className="graph-toolbar__cluster graph-toolbar__cluster--jumps">
          <p className="graph-toolbar__label">Anomaly jumps</p>
          <div className="jump-bar__content">
            {anomalyJumps.map((jump) => (
              <AnomalyJumpButton key={jump.label} jump={jump} onJump={onJump} />
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
                {EVENT_FILTER_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {EVENT_FILTER_LABELS[item]}
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

function AnomalyJumpButton({
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

interface ResizeHandleProps {
  label: string;
  reverse?: boolean;
  position: number;
  onDrag: (width: number) => void;
  onKeyboard: (width: number) => void;
}

export function ResizeHandle({
  label,
  reverse = false,
  position,
  onDrag,
  onKeyboard,
}: ResizeHandleProps) {
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
