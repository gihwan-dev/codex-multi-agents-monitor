import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { GraphSceneModel, LiveMode, RunStatus, SelectionState } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { EventTypeGlyph, GapChip, Panel } from "../../../shared/ui";
import {
  buildContinuationGuideYs,
  buildGraphLayoutSnapshot,
  computeRenderedContentHeight,
  computeVisibleEdgeRoutes,
  computeVisibleRowRange,
  EVENT_ROW_HEIGHT,
  GAP_ROW_HEIGHT,
  ROW_GAP,
  TIME_GUTTER,
} from "../model/graphLayout";

const LANE_STATUS_COLORS: Record<string, string> = {
  running: "var(--color-active)",
  done: "var(--color-success)",
  failed: "var(--color-failed)",
  waiting: "var(--color-waiting)",
  blocked: "var(--color-blocked)",
  interrupted: "var(--color-transfer)",
  cancelled: "var(--color-text-tertiary)",
  queued: "var(--color-text-tertiary)",
  stale: "var(--color-stale)",
  disconnected: "var(--color-disconnected)",
};

const EDGE_COLORS: Record<string, string> = {
  handoff: "var(--color-handoff)",
  transfer: "var(--color-transfer)",
  spawn: "var(--color-active)",
  merge: "rgba(243, 246, 251, 0.72)",
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

interface CausalGraphViewProps {
  scene: GraphSceneModel;
  onSelect: (selection: SelectionState) => void;
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  viewportHeightOverride?: number;
  laneHeaderHeightOverride?: number;
}

export function CausalGraphView({
  scene,
  onSelect,
  followLive,
  liveMode,
  onPauseFollowLive,
  viewportHeightOverride,
  laneHeaderHeightOverride,
}: CausalGraphViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneStripRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(viewportHeightOverride ?? 0);
  const [laneHeaderHeight, setLaneHeaderHeight] = useState(laneHeaderHeightOverride ?? 0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollTopRef = useRef(0);
  const rafRef = useRef(0);
  const layout = buildGraphLayoutSnapshot(scene, viewportWidth);
  const routeMarkerId = useId();
  const bundleById = new Map(scene.edgeBundles.map((bundle) => [bundle.id, bundle]));
  const availableCanvasHeight = Math.max(
    0,
    (viewportHeightOverride ?? viewportHeight) - (laneHeaderHeightOverride ?? laneHeaderHeight),
  );
  const renderedContentHeight = computeRenderedContentHeight(
    layout.contentHeight,
    availableCanvasHeight,
  );
  const continuationGuideYs = buildContinuationGuideYs(
    layout.contentHeight,
    renderedContentHeight,
  );
  const visibleRange = computeVisibleRowRange(
    layout.rowPositions,
    scrollTop,
    availableCanvasHeight,
    4,
  );
  const visibleRows = scene.rows.slice(visibleRange.startIndex, visibleRange.endIndex);
  const visibleRowPositions = layout.rowPositions.slice(
    visibleRange.startIndex,
    visibleRange.endIndex,
  );
  const visibleEdgeRoutes = computeVisibleEdgeRoutes(
    layout.edgeRoutes,
    scrollTop,
    availableCanvasHeight,
    500,
  );

  useEffect(() => {
    if (!followLive || liveMode !== "live" || !scene.latestVisibleEventId) {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "auto",
    });
  }, [followLive, liveMode, scene.latestVisibleEventId]);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateMeasurements = () => {
      const nextViewportWidth = Math.round(viewportElement.clientWidth);
      const nextViewportHeight = Math.round(viewportElement.clientHeight);
      const nextLaneHeaderHeight = laneStripRef.current?.offsetHeight ?? 0;

      setViewportWidth((current) => (current === nextViewportWidth ? current : nextViewportWidth));
      if (viewportHeightOverride === undefined) {
        setViewportHeight((current) =>
          current === nextViewportHeight ? current : nextViewportHeight,
        );
      }
      if (laneHeaderHeightOverride === undefined) {
        setLaneHeaderHeight((current) =>
          current === nextLaneHeaderHeight ? current : nextLaneHeaderHeight,
        );
      }
    };

    updateMeasurements();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateMeasurements();
    });

    observer.observe(viewportElement);
    if (laneStripRef.current) {
      observer.observe(laneStripRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [laneHeaderHeightOverride, viewportHeightOverride]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    if (followLive && liveMode === "live") {
      const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 32;
      if (!nearBottom) {
        onPauseFollowLive();
      }
    }

    scrollTopRef.current = element.scrollTop;
    if (rafRef.current === 0) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setScrollTop(scrollTopRef.current);
      });
    }
  };

  const gridTemplateColumns = `${TIME_GUTTER}px repeat(${scene.lanes.length || 1}, ${layout.laneMetrics.laneWidth}px)`;

  const selectEdge = (edgeId: string) => {
    if (followLive && liveMode === "live") {
      onPauseFollowLive();
    }
    onSelect({ kind: "edge", id: edgeId });
  };

  const handleEdgeKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, edgeId: string) => {
    if (event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectEdge(edgeId);
  };

  return (
    <Panel
      panelSlot="graph-panel"
      title="Graph"
      className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
    >
      {scene.hiddenLaneCount ? (
        <p className="text-[0.8rem] text-muted-foreground">
          {scene.hiddenLaneCount} inactive done lanes are folded to preserve the active path.
        </p>
      ) : null}
      <div
        ref={viewportRef}
        data-slot="graph"
        className="grid min-h-0 flex-1 gap-3"
        style={
          {
            ["--graph-time-gutter" as string]: `${TIME_GUTTER}px`,
            ["--graph-lane-width" as string]: `${layout.laneMetrics.laneWidth}px`,
            ["--graph-card-width" as string]: `${layout.laneMetrics.cardWidth}px`,
            ["--graph-event-row-height" as string]: `${EVENT_ROW_HEIGHT}px`,
            ["--graph-gap-row-height" as string]: `${GAP_ROW_HEIGHT}px`,
            ["--graph-row-gap" as string]: `${ROW_GAP}px`,
          } as CSSProperties
        }
      >
        <div
          ref={scrollRef}
          data-slot="graph-scroll"
          className="h-full min-h-0 overflow-auto border-t border-white/8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
        >
          <div
            ref={laneStripRef}
            data-slot="graph-lane-strip"
            className="sticky top-0 z-[4] grid items-center border-b border-white/8 bg-[linear-gradient(180deg,rgba(20,24,33,0.98),rgba(20,24,33,0.92))]"
            style={{ gridTemplateColumns, width: layout.contentWidth }}
          >
            <div
              data-slot="graph-time-header"
              className="sticky left-0 z-[3] px-3 py-2 text-[0.76rem] uppercase tracking-[0.06em] text-muted-foreground"
              style={{
                background:
                  "linear-gradient(90deg, rgba(20, 24, 33, 0.98), rgba(20, 24, 33, 0.88))",
              }}
            >
              Time (dur)
            </div>
            {scene.lanes.map((lane) => (
              <header
                key={lane.laneId}
                data-slot="graph-lane-header"
                data-lane-id={lane.laneId}
                className="relative flex min-h-12 items-center overflow-hidden border-l border-white/6 px-3.5 py-2"
              >
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 size-0 border-solid"
                  style={{
                    borderWidth: "0 12px 12px 0",
                    borderColor: `transparent ${LANE_STATUS_COLORS[lane.status] ?? "var(--color-text-tertiary)"} transparent transparent`,
                  }}
                />
                <div className="relative flex min-w-0 flex-1 items-center justify-center gap-2">
                  <strong className="truncate">{lane.name}</strong>
                  {lane.role !== "session" && lane.role !== "user" ? (
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.68rem] font-medium text-[var(--color-text-muted)]">
                      {lane.role}
                    </span>
                  ) : null}
                  <span className="shrink-0 text-[0.74rem] text-[var(--color-text-tertiary)]">
                    {lane.model}
                  </span>
                </div>
              </header>
            ))}
          </div>

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
                  stroke="rgba(166, 175, 189, 0.18)"
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
                        ? "rgba(77, 163, 255, 0.34)"
                        : row.inPath
                          ? "rgba(166, 175, 189, 0.24)"
                          : "rgba(166, 175, 189, 0.12)"
                    }
                    strokeWidth={row.selected || row.inPath ? 1.25 : 1}
                    strokeDasharray="2 6"
                  />
                );
              })}

              {continuationGuideYs
                .filter((guideY) => guideY >= scrollTop - 500 && guideY <= scrollTop + availableCanvasHeight + 500)
                .map((guideY) => (
                  <line
                    key={`continuation-guide-${guideY}`}
                    data-slot="graph-row-guide"
                    data-guide-kind="continuation"
                    x1={TIME_GUTTER}
                    y1={guideY}
                    x2={layout.contentWidth}
                    y2={guideY}
                    stroke="rgba(166, 175, 189, 0.075)"
                    strokeWidth={1}
                    strokeDasharray="2 7"
                  />
                ))}

              {visibleEdgeRoutes.map((route) => {
                const bundle = bundleById.get(route.bundleId);
                if (!bundle) {
                  return null;
                }

                const color = EDGE_COLORS[bundle.edgeType] ?? "rgba(166, 175, 189, 0.34)";
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
                      stroke="rgba(20, 24, 33, 0.96)"
                      strokeWidth={1.5}
                    />
                    <circle
                      data-slot="graph-route-port"
                      data-port="target"
                      cx={route.targetPort.x}
                      cy={route.targetPort.y}
                      r={4}
                      fill="currentColor"
                      stroke="rgba(20, 24, 33, 0.96)"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>

            <div data-slot="graph-rows" className="relative z-[1]" style={{ height: renderedContentHeight }}>
              {visibleRows.map((row, visibleIndex) => {
                const rowPos = visibleRowPositions[visibleIndex];
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
                        background: "rgba(255, 255, 255, 0.06)",
                        borderTop: "1px dashed rgba(255, 255, 255, 0.22)",
                        borderBottom: "1px dashed rgba(255, 255, 255, 0.22)",
                      }}
                    />
                    <div
                      data-slot="graph-gap-time"
                      className="sticky left-0 z-[3] flex min-h-full items-center px-3 text-[0.74rem] font-mono text-muted-foreground"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(20, 24, 33, 0.98), rgba(20, 24, 33, 0.88))",
                      }}
                    />
                    <div
                      className="relative z-[1] flex items-center justify-center"
                      style={{ gridColumn: `2 / span ${scene.lanes.length || 1}` }}
                    >
                      <GapChip
                        label={row.label}
                        durationMs={row.durationMs}
                      />
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
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(20, 24, 33, 0.98), rgba(20, 24, 33, 0.88))",
                      }}
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
                                className="absolute inset-y-0 left-1/2 z-0 w-0.5 -translate-x-1/2 bg-[linear-gradient(180deg,rgba(166,175,189,0.045),rgba(166,175,189,0))]"
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
                                  (row.eventType === "turn.started" || row.eventType === "turn.finished") &&
                                    "rounded-md",
                                )}
                                style={
                                  eventLayout
                                    ? {
                                        ...buildCardStyle(row.eventType, row.selected, row.inPath),
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
                      selectEdge(bundle.primaryEdgeId);
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
        </div>
      </div>
    </Panel>
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
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(24, 29, 39, 1), rgba(16, 20, 29, 1))",
    boxShadow: "0 18px 34px rgba(4, 8, 14, 0.26)",
  };

  if (inPath) {
    base.borderColor = "rgba(77, 163, 255, 0.28)";
    base.boxShadow = "inset 0 0 0 1px rgba(77, 163, 255, 0.12), 0 18px 34px rgba(4, 8, 14, 0.26)";
  }

  if (selected) {
    base.borderColor = "rgba(77, 163, 255, 0.58)";
    base.boxShadow = "0 0 0 1px rgba(77, 163, 255, 0.28), 0 18px 34px rgba(4, 8, 14, 0.26)";
  }

  switch (eventType) {
    case "user.prompt":
      base.borderLeft = "3px solid var(--color-active)";
      base.background = "linear-gradient(180deg, rgba(77, 163, 255, 0.06), rgba(16, 20, 29, 1))";
      break;
    case "tool.started":
      base.borderLeft = "3px solid var(--color-transfer)";
      break;
    case "tool.finished":
      base.borderLeft = "3px solid var(--color-success)";
      break;
    case "llm.started":
      base.borderStyle = "dashed";
      base.opacity = 0.8;
      break;
    case "agent.spawned":
      base.borderLeft = "3px solid var(--color-active)";
      break;
    case "agent.finished":
      base.borderLeft = "3px solid rgba(166, 175, 189, 0.4)";
      break;
    case "error":
      base.borderLeft = "3px solid var(--color-failed)";
      base.background = "linear-gradient(180deg, rgba(255, 107, 107, 0.06), rgba(16, 20, 29, 1))";
      break;
    case "note":
      base.borderLeft = "3px solid rgba(166, 175, 189, 0.25)";
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
