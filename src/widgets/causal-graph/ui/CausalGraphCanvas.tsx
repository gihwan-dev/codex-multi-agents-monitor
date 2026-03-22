import type { CSSProperties, KeyboardEvent } from "react";
import type {
  GraphSceneEdgeBundle,
  GraphSceneModel,
  RunStatus,
  SelectionState,
} from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { EventTypeGlyph, GapChip } from "../../../shared/ui";
import {
  type EdgeRouteLayout,
  type GraphLayoutSnapshot,
  type RowPosition,
  TIME_GUTTER,
} from "../model/graphLayout";

const EDGE_COLORS: Record<string, string> = {
  handoff: "var(--color-handoff)",
  transfer: "var(--color-transfer)",
  spawn: "var(--color-active)",
  merge: "var(--color-graph-edge-merge)",
};

const GRAPH_STATUS_COLORS: Record<RunStatus, string> = {
  queued: "var(--color-text-tertiary)",
  running: "var(--color-active)",
  waiting: "var(--color-waiting)",
  blocked: "var(--color-blocked)",
  interrupted: "var(--color-transfer)",
  done: "var(--color-success)",
  failed: "var(--color-failed)",
  cancelled: "var(--color-text-tertiary)",
  stale: "var(--color-stale)",
  disconnected: "var(--color-disconnected)",
};

interface CausalGraphCanvasProps {
  availableCanvasHeight: number;
  bundleById: Map<string, GraphSceneEdgeBundle>;
  continuationGuideYs: number[];
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  onSelectEdge: (edgeId: string) => void;
  renderedContentHeight: number;
  routeMarkerId: string;
  scene: GraphSceneModel;
  scrollTop: number;
  visibleEdgeRoutes: EdgeRouteLayout[];
  visibleRowPositions: RowPosition[];
  visibleRows: GraphSceneModel["rows"];
}

export function CausalGraphCanvas({
  availableCanvasHeight,
  bundleById,
  continuationGuideYs,
  gridTemplateColumns,
  layout,
  onSelect,
  onSelectEdge,
  renderedContentHeight,
  routeMarkerId,
  scene,
  scrollTop,
  visibleEdgeRoutes,
  visibleRowPositions,
  visibleRows,
}: CausalGraphCanvasProps) {
  const handleEdgeKeyDown = (
    event: KeyboardEvent<HTMLAnchorElement>,
    edgeId: string,
  ) => {
    if (event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelectEdge(edgeId);
  };

  return (
    <div
      className="relative"
      style={{ width: layout.contentWidth, minHeight: renderedContentHeight }}
    >
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${layout.contentWidth} ${renderedContentHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={routeMarkerId}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
          </marker>
        </defs>

        {scene.lanes.map((lane) => (
          <line
            key={lane.laneId}
            x1={layout.laneCenterById.get(lane.laneId) ?? 0}
            y1={0}
            x2={layout.laneCenterById.get(lane.laneId) ?? 0}
            y2={renderedContentHeight}
            stroke="var(--color-graph-lane-line)"
            strokeWidth={2}
            strokeDasharray="3 8"
          />
        ))}

        {visibleRows.map((row) => {
          if (row.kind !== "event") {
            return null;
          }

          const guideY = layout.rowGuideYByEventId.get(row.eventId);
          if (guideY === undefined) {
            return null;
          }

          return (
            <line
              key={`guide-${row.eventId}`}
              data-slot="graph-row-guide"
              data-guide-kind={row.selected ? "selected" : row.inPath ? "active" : "default"}
              data-event-id={row.eventId}
              x1={TIME_GUTTER}
              y1={guideY}
              x2={layout.contentWidth}
              y2={guideY}
              stroke={
                row.selected
                  ? "var(--color-graph-guide-selected)"
                  : row.inPath
                    ? "var(--color-graph-guide-active)"
                    : "var(--color-graph-guide-default)"
              }
              strokeWidth={row.selected || row.inPath ? 1.25 : 1}
              strokeDasharray="2 6"
            />
          );
        })}

        {continuationGuideYs
          .filter(
            (guideY) =>
              guideY >= scrollTop - 500 &&
              guideY <= scrollTop + availableCanvasHeight + 500,
          )
          .map((guideY) => (
            <line
              key={`continuation-guide-${guideY}`}
              data-slot="graph-row-guide"
              data-guide-kind="continuation"
              x1={TIME_GUTTER}
              y1={guideY}
              x2={layout.contentWidth}
              y2={guideY}
              stroke="var(--color-graph-guide-continuation)"
              strokeWidth={1}
              strokeDasharray="2 7"
            />
          ))}

        {visibleEdgeRoutes.map((route) => {
          const bundle = bundleById.get(route.bundleId);
          if (!bundle) {
            return null;
          }

          const color = EDGE_COLORS[bundle.edgeType] ?? "var(--color-graph-edge-neutral)";
          const strokeWidth = bundle.inPath || bundle.selected ? 3.5 : 2.5;
          const dashArray =
            bundle.edgeType === "handoff"
              ? "6 4"
              : bundle.edgeType === "transfer"
                ? "2 4"
                : bundle.edgeType === "merge"
                  ? "1 3"
                  : undefined;

          return (
            <g
              key={bundle.id}
              data-slot="graph-route"
              data-edge-type={bundle.edgeType}
              data-selected={bundle.selected ? "true" : "false"}
              data-in-path={bundle.inPath ? "true" : "false"}
              style={{
                color,
                opacity: bundle.inPath || bundle.selected ? 1 : 0.88,
              }}
            >
              <path
                d={route.path}
                markerEnd={`url(#${routeMarkerId})`}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dashArray}
              />
              <circle
                data-slot="graph-route-port"
                data-port="source"
                cx={route.sourcePort.x}
                cy={route.sourcePort.y}
                r={4}
                fill="currentColor"
                stroke="var(--color-graph-port-outline)"
                strokeWidth={1.5}
              />
              <circle
                data-slot="graph-route-port"
                data-port="target"
                cx={route.targetPort.x}
                cy={route.targetPort.y}
                r={4}
                fill="currentColor"
                stroke="var(--color-graph-port-outline)"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
      </svg>

      <div
        data-slot="graph-rows"
        className="relative z-[1]"
        style={{ height: renderedContentHeight }}
      >
        {visibleRows.map((row, visibleIndex) => {
          const rowPos = visibleRowPositions[visibleIndex];
          if (!rowPos) {
            return null;
          }

          return row.kind === "gap" ? (
            <div
              key={row.id}
              data-slot="graph-gap"
              data-gap-id={row.id}
              data-expanded="false"
              className="absolute left-0 grid w-full items-center"
              style={{ gridTemplateColumns, top: rowPos.topY, height: rowPos.height }}
            >
              <div
                className="absolute inset-y-0 right-0"
                style={{
                  left: TIME_GUTTER,
                  background: "var(--color-graph-gap-fill)",
                  borderTop: "1px dashed var(--color-graph-gap-border)",
                  borderBottom: "1px dashed var(--color-graph-gap-border)",
                }}
              />
              <div
                data-slot="graph-gap-time"
                className="sticky left-0 z-[3] flex min-h-full items-center px-3 text-[0.74rem] font-mono text-muted-foreground"
                style={{ background: "var(--gradient-graph-time)" }}
              />
              <div
                className="relative z-[1] flex items-center justify-center"
                style={{ gridColumn: `2 / span ${scene.lanes.length || 1}` }}
              >
                <GapChip label={row.label} durationMs={row.durationMs} />
              </div>
            </div>
          ) : (
            <div
              key={row.id}
              data-slot="graph-event-row"
              data-event-id={row.eventId}
              className="absolute left-0 grid w-full"
              style={{ gridTemplateColumns, top: rowPos.topY, height: rowPos.height }}
            >
              <div
                data-slot="graph-event-time"
                className="sticky left-0 z-[3] flex min-h-full items-center px-3 text-[0.74rem] font-mono text-muted-foreground"
                style={{ background: "var(--gradient-graph-time)" }}
              >
                <div className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
                  <strong>{row.timeLabel}</strong>
                  <span className="text-[0.68rem] text-[var(--color-text-tertiary)]">
                    ({row.durationLabel})
                  </span>
                </div>
              </div>
              {scene.lanes.map((lane) => {
                const eventLayout = layout.eventById.get(row.eventId);

                return (
                  <div
                    key={`${row.id}:${lane.laneId}`}
                    data-slot="graph-lane-cell"
                    data-lane-id={lane.laneId}
                    data-occupied={lane.laneId === row.laneId ? "true" : "false"}
                    className="relative min-h-[var(--graph-event-row-height)]"
                  >
                    {lane.laneId === row.laneId ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-1/2 z-0 w-0.5 -translate-x-1/2"
                          style={{
                            background:
                              "linear-gradient(180deg, var(--color-graph-connector), transparent)",
                          }}
                        />
                        <button
                          type="button"
                          data-slot="graph-event-card"
                          data-event-id={row.eventId}
                          data-event-type={row.eventType}
                          data-selected={row.selected ? "true" : "false"}
                          data-in-path={row.inPath ? "true" : "false"}
                          className={cn(
                            "absolute left-1/2 z-[1] grid h-20 min-h-20 -translate-x-1/2 content-center gap-1 rounded-[14px] px-3 py-2.5 text-left text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            row.eventType === "tool.started" || row.eventType === "tool.finished"
                              ? "rounded-lg"
                              : "",
                            (row.eventType === "turn.started" ||
                              row.eventType === "turn.finished") &&
                              "rounded-md",
                          )}
                          style={
                            eventLayout
                              ? {
                                  ...buildCardStyle(
                                    row.eventType,
                                    row.selected,
                                    row.inPath,
                                  ),
                                  top: `${eventLayout.cardRect.y - eventLayout.rowTop}px`,
                                  width: `${eventLayout.cardRect.width}px`,
                                }
                              : undefined
                          }
                          onClick={() => onSelect({ kind: "event", id: row.eventId })}
                          aria-label={`${row.title} ${row.status}`}
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                            <span className="flex min-w-0 items-start gap-1.5">
                              <EventTypeGlyph eventType={row.eventType} size={13} />
                              <strong className="line-clamp-2 text-[0.92rem] leading-[1.08] [overflow-wrap:anywhere]">
                                {row.title}
                              </strong>
                            </span>
                            <GraphStatusDot status={row.status} />
                          </div>
                          {row.summary !== "n/a" ? (
                            <p
                              data-slot="graph-card-summary"
                              className="line-clamp-2 text-[0.72rem] leading-[1.3] text-[var(--color-text-muted)]"
                            >
                              {row.summary}
                            </p>
                          ) : null}
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <svg
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
        viewBox={`0 0 ${layout.contentWidth} ${renderedContentHeight}`}
        preserveAspectRatio="none"
      >
        <title>Interactive graph edge hit targets</title>
        {visibleEdgeRoutes.map((route) => {
          const bundle = bundleById.get(route.bundleId);
          if (!bundle) {
            return null;
          }

          return (
            <a
              key={`interactive-route-${route.bundleId}`}
              href={`#${bundle.primaryEdgeId}`}
              aria-label={`${bundle.edgeType} edge between ${bundle.sourceEventId} and ${bundle.targetEventId}`}
              onClick={(event) => {
                event.preventDefault();
                onSelectEdge(bundle.primaryEdgeId);
              }}
              onKeyDown={(event) => handleEdgeKeyDown(event, bundle.primaryEdgeId)}
            >
              <title>{`${bundle.edgeType}: ${bundle.label}`}</title>
              <path
                data-slot="graph-route-hitbox"
                data-edge-type={bundle.edgeType}
                d={route.path}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                pointerEvents="stroke"
              />
            </a>
          );
        })}
      </svg>
    </div>
  );
}

function GraphStatusDot({ status }: { status: RunStatus }) {
  return (
    <span
      aria-hidden="true"
      data-slot="graph-status-dot"
      data-status={status}
      className="mt-1 inline-flex size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: GRAPH_STATUS_COLORS[status] }}
    />
  );
}

function buildCardStyle(
  eventType: string,
  selected: boolean,
  inPath: boolean,
): CSSProperties {
  const base: CSSProperties = {
    minHeight: 80,
    borderWidth: 1,
    borderStyle: "solid",
    borderTopColor: "var(--color-graph-card-border)",
    borderRightColor: "var(--color-graph-card-border)",
    borderBottomColor: "var(--color-graph-card-border)",
    borderLeftColor: "var(--color-graph-card-border)",
    background: "var(--gradient-graph-card-surface)",
    boxShadow: "var(--shadow-graph-card)",
  };

  if (inPath) {
    base.borderTopColor = "var(--color-graph-card-border-in-path)";
    base.borderRightColor = "var(--color-graph-card-border-in-path)";
    base.borderBottomColor = "var(--color-graph-card-border-in-path)";
    base.borderLeftColor = "var(--color-graph-card-border-in-path)";
    base.boxShadow = "var(--shadow-graph-card-in-path)";
  }

  if (selected) {
    base.borderTopColor = "var(--color-graph-card-border-selected)";
    base.borderRightColor = "var(--color-graph-card-border-selected)";
    base.borderBottomColor = "var(--color-graph-card-border-selected)";
    base.borderLeftColor = "var(--color-graph-card-border-selected)";
    base.boxShadow = "var(--shadow-graph-card-selected)";
  }

  switch (eventType) {
    case "user.prompt":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-active)";
      base.background = "var(--gradient-graph-card-user)";
      break;
    case "tool.started":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-transfer)";
      break;
    case "tool.finished":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-success)";
      break;
    case "llm.started":
      base.borderStyle = "dashed";
      base.opacity = 0.8;
      break;
    case "agent.spawned":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-active)";
      break;
    case "agent.finished":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-graph-card-muted-accent)";
      break;
    case "error":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-failed)";
      base.background = "var(--gradient-graph-card-error)";
      break;
    case "note":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-graph-card-note-accent)";
      base.opacity = 0.85;
      break;
    case "turn.started":
    case "turn.finished":
      base.borderStyle = "dashed";
      base.borderRadius = 6;
      base.background = "transparent";
      base.boxShadow = "none";
      base.opacity = 0.6;
      break;
    default:
      break;
  }

  return base;
}
