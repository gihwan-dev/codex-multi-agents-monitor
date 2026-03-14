import type { GraphCanvasEdge, GraphCanvasModel, SelectionState } from "../../../shared/domain";
import { Panel, StatusChip } from "../../../shared/ui";

const LANE_WIDTH = 220;
const STEP_HEIGHT = 108;
const NODE_X_OFFSET = 110;
const NODE_Y_OFFSET = 46;

interface CausalGraphViewProps {
  model: GraphCanvasModel;
  onSelect: (selection: SelectionState) => void;
}

export function CausalGraphView({ model, onSelect }: CausalGraphViewProps) {
  const laneIndexById = new Map(model.lanes.map((lane, index) => [lane.laneId, index]));
  const stepIndexById = new Map(model.steps.map((step, index) => [step.id, index]));
  const edgeWidth = Math.max(model.lanes.length * LANE_WIDTH, LANE_WIDTH);
  const edgeHeight = Math.max(model.steps.length * STEP_HEIGHT, STEP_HEIGHT);

  return (
    <Panel title="Graph" className="canvas-panel graph-canvas-panel">
      {model.hiddenLaneCount ? (
        <p className="graph-panel__collapsed-copy">
          {model.hiddenLaneCount} inactive done lanes are folded to preserve the active path.
        </p>
      ) : null}
      <div className="graph-canvas">
        <div
          className="graph-canvas__lane-strip"
          style={{
            gridTemplateColumns: `112px repeat(${model.lanes.length || 1}, minmax(${LANE_WIDTH}px, 1fr))`,
          }}
        >
          <div className="graph-canvas__corner">Step</div>
          {model.lanes.map((lane) => (
            <header key={lane.laneId} className="graph-canvas__lane">
              <div className="graph-canvas__lane-title">
                <strong>{lane.name}</strong>
                <StatusChip status={lane.status} subtle />
              </div>
              <span>
                {lane.role} · {lane.model}
              </span>
            </header>
          ))}
        </div>

        <div className="graph-canvas__scroll">
          <div
            className="graph-canvas__overlay"
            style={{ width: edgeWidth, height: edgeHeight }}
            aria-hidden="true"
          >
            <svg
              className="graph-canvas__edges"
              viewBox={`0 0 ${edgeWidth} ${edgeHeight}`}
              preserveAspectRatio="none"
            >
              <title>Graph causal edges</title>
              {model.edges.map((edge) => (
                <GraphEdgePath
                  key={edge.id}
                  edge={edge}
                  laneIndexById={laneIndexById}
                  stepIndexById={stepIndexById}
                />
              ))}
            </svg>
            {model.edges.map((edge) => {
              const geometry = getEdgeGeometry(edge, laneIndexById, stepIndexById);
              if (!geometry) {
                return null;
              }

              return (
                <button
                  key={`hotspot-${edge.id}`}
                  type="button"
                  className={`graph-edge-hotspot ${edge.selected ? "graph-edge-hotspot--selected" : ""}`.trim()}
                  style={{
                    left: `${geometry.hotspotX - 12}px`,
                    top: `${geometry.hotspotY - 12}px`,
                  }}
                  aria-label={`${edge.edgeType} edge`}
                  onClick={() => onSelect({ kind: "edge", id: edge.id })}
                />
              );
            })}
          </div>

          <div className="graph-canvas__steps">
            {model.steps.map((step) =>
              step.kind === "gap" ? (
                <div key={step.id} className="graph-canvas__gap-row">
                  <span>{step.label}</span>
                </div>
              ) : (
                <div key={step.id} className="graph-canvas__event-row">
                  <div className="graph-canvas__time">
                    <strong>{step.timeLabel}</strong>
                    <span>{step.durationLabel}</span>
                  </div>
                  <div
                    className="graph-canvas__track"
                    style={{
                      gridTemplateColumns: `repeat(${model.lanes.length || 1}, minmax(${LANE_WIDTH}px, 1fr))`,
                    }}
                  >
                    {model.lanes.map((lane) =>
                      lane.laneId === step.laneId ? (
                        <button
                          key={`${step.id}:${lane.laneId}`}
                          type="button"
                          className={[
                            "graph-node",
                            step.selected ? "graph-node--selected" : "",
                            step.inPath ? "graph-node--path" : "",
                            step.dimmed ? "graph-node--dimmed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => onSelect({ kind: "event", id: step.eventId })}
                        >
                          <div className="graph-node__head">
                            <strong>{step.title}</strong>
                            <StatusChip status={step.status} subtle />
                          </div>
                          <p>{step.summary}</p>
                          {step.waitReason ? (
                            <span className="graph-node__callout">{step.waitReason}</span>
                          ) : null}
                        </button>
                      ) : (
                        <div key={`${step.id}:${lane.laneId}`} className="graph-canvas__ghost-cell" />
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function GraphEdgePath({
  edge,
  laneIndexById,
  stepIndexById,
}: {
  edge: GraphCanvasEdge;
  laneIndexById: Map<string, number>;
  stepIndexById: Map<string, number>;
}) {
  const geometry = getEdgeGeometry(edge, laneIndexById, stepIndexById);
  if (!geometry) {
    return null;
  }

  return (
    <g
      className={[
        "graph-edge",
        `graph-edge--${edge.edgeType}`,
        edge.inPath ? "graph-edge--path" : "",
        edge.selected ? "graph-edge--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <path d={geometry.path} />
      <circle cx={geometry.x2} cy={geometry.y2} r="4" />
    </g>
  );
}

function getEdgeGeometry(
  edge: GraphCanvasEdge,
  laneIndexById: Map<string, number>,
  stepIndexById: Map<string, number>,
) {
  const sourceLaneIndex = laneIndexById.get(edge.sourceLaneId);
  const targetLaneIndex = laneIndexById.get(edge.targetLaneId);
  const sourceStepIndex = stepIndexById.get(edge.sourceStepId);
  const targetStepIndex = stepIndexById.get(edge.targetStepId);

  if (
    sourceLaneIndex === undefined ||
    targetLaneIndex === undefined ||
    sourceStepIndex === undefined ||
    targetStepIndex === undefined
  ) {
    return null;
  }

  const x1 = sourceLaneIndex * LANE_WIDTH + NODE_X_OFFSET;
  const x2 = targetLaneIndex * LANE_WIDTH + NODE_X_OFFSET;
  const y1 = sourceStepIndex * STEP_HEIGHT + NODE_Y_OFFSET;
  const y2 = targetStepIndex * STEP_HEIGHT + NODE_Y_OFFSET;
  const controlY = y1 + (y2 - y1) / 2;
  return {
    x2,
    y2,
    path: `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`,
    hotspotX: x1 + (x2 - x1) / 2,
    hotspotY: controlY,
  };
}
