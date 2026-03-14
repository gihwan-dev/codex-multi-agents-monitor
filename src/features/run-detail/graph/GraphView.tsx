import type { EdgeRecord, LaneDisplay, SelectionState } from "../../../shared/domain";
import { EventRow, GapChip, LaneHeader, Panel } from "../../../shared/ui";

interface GraphViewProps {
  lanes: LaneDisplay[];
  edges: EdgeRecord[];
  selectedId: string | null;
  onSelect: (selection: SelectionState) => void;
  expandedGapIds: Set<string>;
  onToggleGap: (gapId: string) => void;
}

export function GraphView({
  lanes,
  edges,
  selectedId,
  onSelect,
  expandedGapIds,
  onToggleGap,
}: GraphViewProps) {
  return (
    <Panel title="Graph" className="canvas-panel">
      <div className="edge-strip">
        {edges.map((edge) => (
          <button
            key={edge.edgeId}
            type="button"
            className={`edge-pill edge-pill--${edge.edgeType}`}
            onClick={() => onSelect({ kind: "edge", id: edge.edgeId })}
          >
            {edge.edgeType} · {edge.payloadPreview}
          </button>
        ))}
      </div>
      <div className="graph-view">
        {lanes.map((laneDisplay) =>
          laneDisplay.hiddenByDegradation ? (
            <article key={laneDisplay.lane.laneId} className="graph-lane graph-lane--compressed">
              <LaneHeader
                name={laneDisplay.lane.name}
                role={laneDisplay.lane.role}
                model={laneDisplay.lane.model}
                badge={laneDisplay.lane.badge}
                status={laneDisplay.lane.laneStatus}
              />
              <p className="graph-lane__compressed-copy">
                Collapsed by large-run degradation. Expand through filters or anomaly jumps.
              </p>
            </article>
          ) : (
            <article key={laneDisplay.lane.laneId} className="graph-lane">
              <LaneHeader
                name={laneDisplay.lane.name}
                role={laneDisplay.lane.role}
                model={laneDisplay.lane.model}
                badge={laneDisplay.lane.badge}
                status={laneDisplay.lane.laneStatus}
              />
              <div className="graph-lane__items">
                {laneDisplay.items.map((item) =>
                  item.kind === "event" ? (
                    <EventRow
                      key={item.event.eventId}
                      event={item.event}
                      selected={selectedId === item.event.eventId}
                      onSelect={onSelect}
                    />
                  ) : (
                    <GapChip
                      key={item.gap.gapId}
                      gap={item.gap}
                      expanded={!expandedGapIds.has(item.gap.gapId)}
                      onToggle={onToggleGap}
                    />
                  ),
                )}
              </div>
            </article>
          ),
        )}
      </div>
    </Panel>
  );
}
