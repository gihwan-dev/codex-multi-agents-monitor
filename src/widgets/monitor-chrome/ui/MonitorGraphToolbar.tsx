import type {
  AnomalyJump,
  EventType,
  RunDataset,
  RunFilters,
} from "../../../entities/run";

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
