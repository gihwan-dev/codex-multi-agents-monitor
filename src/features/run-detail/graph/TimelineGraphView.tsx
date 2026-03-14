import {
  type EdgeRecord,
  type EventRecord,
  formatDuration,
  formatTimestamp,
  type LaneDisplay,
  type SelectionState,
} from "../../../shared/domain";
import { Panel } from "../../../shared/ui";

const GAP_THRESHOLD_MS = 90_000;

interface TimelineGraphViewProps {
  lanes: LaneDisplay[];
  edges: EdgeRecord[];
  selectedId: string | null;
  onSelect: (selection: SelectionState) => void;
}

export function TimelineGraphView({ lanes, edges, selectedId, onSelect }: TimelineGraphViewProps) {
  const visibleLanes = lanes.filter((lane) => !lane.hiddenByDegradation);
  const events = visibleLanes
    .flatMap((lane) => lane.items.flatMap((item) => (item.kind === "event" ? [item.event] : [])))
    .sort((left, right) => left.startTs - right.startTs);
  const rows = buildRows(events, visibleLanes.length);
  const selectedEdge = edges.find((edge) => edge.edgeId === selectedId) ?? null;

  return (
    <Panel title="Graph" className="canvas-panel graph-panel">
      {lanes.length !== visibleLanes.length ? (
        <p className="graph-panel__collapsed-copy">
          {lanes.length - visibleLanes.length} inactive done lanes are folded to preserve the active path.
        </p>
      ) : null}
      <div
        className="timeline-grid"
        style={{ gridTemplateColumns: `120px repeat(${visibleLanes.length || 1}, minmax(220px, 1fr))` }}
      >
        <div className="timeline-grid__corner">Time</div>
        {visibleLanes.map((lane) => (
          <header key={lane.lane.laneId} className="timeline-grid__lane">
            <strong>{lane.lane.name}</strong>
            <span>
              {lane.lane.role} · {lane.lane.model}
            </span>
          </header>
        ))}
        {rows.map((row) =>
          row.event ? (
            <div key={row.id} className="timeline-event-row">
              <div className="timeline-event-row__time">
                <strong>{formatTimestamp(row.event.startTs)}</strong>
                <span>{formatDuration(row.event.durationMs)}</span>
              </div>
              {visibleLanes.map((lane) => {
                const laneEvent = lane.items.find(
                  (item) => item.kind === "event" && item.event.eventId === row.event?.eventId,
                );
                if (!laneEvent || laneEvent.kind !== "event") {
                  return (
                    <div
                      key={`${row.id}:${lane.lane.laneId}`}
                      className="timeline-event timeline-event--empty"
                      aria-hidden="true"
                    />
                  );
                }
                const inPath =
                  selectedId === laneEvent.event.eventId ||
                  (selectedEdge
                    ? selectedEdge.sourceEventId === laneEvent.event.eventId ||
                      selectedEdge.targetEventId === laneEvent.event.eventId
                    : false);
                return (
                  <article
                    key={`${row.id}:${lane.lane.laneId}`}
                    className={`timeline-event ${selectedId === laneEvent.event.eventId ? "timeline-event--selected" : ""} ${inPath ? "timeline-event--path" : ""}`.trim()}
                  >
                    <button
                      type="button"
                      className="timeline-event__surface"
                      onClick={() => onSelect({ kind: "event", id: laneEvent.event.eventId })}
                    >
                      <div className="timeline-event__header">
                        <strong>{laneEvent.event.title}</strong>
                        <span>{laneEvent.event.status}</span>
                      </div>
                      <p>{laneEvent.event.outputPreview ?? laneEvent.event.inputPreview ?? "n/a"}</p>
                      {laneEvent.event.waitReason ? (
                        <span className="timeline-event__callout">
                          wait_reason: {laneEvent.event.waitReason}
                        </span>
                      ) : null}
                    </button>
                    <div className="timeline-event__edges">
                      {edges
                        .filter(
                          (edge) =>
                            edge.sourceEventId === laneEvent.event.eventId ||
                            edge.targetEventId === laneEvent.event.eventId,
                        )
                        .map((edge) => (
                          <button
                            key={edge.edgeId}
                            type="button"
                            className={`timeline-edge timeline-edge--${edge.edgeType} ${selectedId === edge.edgeId ? "timeline-edge--path" : ""}`.trim()}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelect({ kind: "edge", id: edge.edgeId });
                            }}
                          >
                            {edge.sourceEventId === laneEvent.event.eventId ? "out" : "in"} · {edge.edgeType}
                          </button>
                        ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div key={row.id} className="timeline-gap-row">
              <div className="timeline-gap-row__time">Gap</div>
              <div className="timeline-gap-row__body" style={{ gridColumn: `span ${visibleLanes.length}` }}>
                {row.gapLabel}
              </div>
            </div>
          ),
        )}
      </div>
    </Panel>
  );
}

function buildRows(events: EventRecord[], laneCount: number) {
  const rows: Array<{ id: string; event?: EventRecord; gapLabel?: string }> = [];
  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    const previous = events[index - 1];
    if (previous) {
      const delta = current.startTs - (previous.endTs ?? previous.startTs);
      if (delta >= GAP_THRESHOLD_MS) {
        rows.push({
          id: `gap-${previous.eventId}-${current.eventId}`,
          gapLabel: `${formatDuration(delta)} hidden · ${laneCount} lanes quiet`,
        });
      }
    }
    rows.push({ id: current.eventId, event: current });
  }
  return rows;
}
