import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import type { GraphSceneEdgeBundle, GraphSceneModel, LiveMode, SelectionState } from "../../../shared/domain";
import { Panel, StatusChip } from "../../../shared/ui";

const TIME_GUTTER = 88;
const LANE_WIDTH = 224;
const EVENT_ROW_HEIGHT = 132;
const GAP_ROW_HEIGHT = 52;
const ROW_GAP = 16;
const ANCHOR_OFFSET_Y = 28;

interface CausalGraphViewProps {
  scene: GraphSceneModel;
  onSelect: (selection: SelectionState) => void;
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
}

interface EventLayout {
  eventId: string;
  laneId: string;
  anchorX: number;
  anchorY: number;
  cardRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface EdgeRouteLayout {
  bundleId: string;
  edgeType: GraphSceneEdgeBundle["edgeType"];
  path: string;
  hotspotX: number;
  hotspotY: number;
  targetX: number;
  targetY: number;
}

interface GraphLayoutSnapshot {
  contentWidth: number;
  contentHeight: number;
  laneCenterById: Map<string, number>;
  eventById: Map<string, EventLayout>;
  edgeRoutes: EdgeRouteLayout[];
}

interface ActiveHighlight {
  eventIds: Set<string>;
  bundleIds: Set<string>;
  laneIds: Set<string>;
}

export function CausalGraphView({
  scene,
  onSelect,
  followLive,
  liveMode,
  onPauseFollowLive,
}: CausalGraphViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSelection, setActiveSelection] = useState<SelectionState | null>(null);
  const layout = buildGraphLayoutSnapshot(scene);
  const activeHighlight = buildActiveHighlight(scene, activeSelection);
  const routeMarkerId = useId();

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

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element || !followLive || liveMode !== "live") {
      return;
    }

    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 32;
    if (!nearBottom) {
      onPauseFollowLive();
    }
  };

  const gridTemplateColumns = `${TIME_GUTTER}px repeat(${scene.lanes.length || 1}, ${LANE_WIDTH}px)`;

  return (
    <Panel title="Graph" className="canvas-panel graph-sequence-panel">
      {scene.hiddenLaneCount ? (
        <p className="graph-panel__collapsed-copy">
          {scene.hiddenLaneCount} inactive done lanes are folded to preserve the active path.
        </p>
      ) : null}
      <div
        className="graph-sequence"
        style={
          {
            ["--graph-time-gutter" as string]: `${TIME_GUTTER}px`,
            ["--graph-lane-width" as string]: `${LANE_WIDTH}px`,
            ["--graph-event-row-height" as string]: `${EVENT_ROW_HEIGHT}px`,
            ["--graph-gap-row-height" as string]: `${GAP_ROW_HEIGHT}px`,
            ["--graph-row-gap" as string]: `${ROW_GAP}px`,
          } as CSSProperties
        }
      >
        <div ref={scrollRef} className="graph-sequence__scroll" onScroll={handleScroll}>
          <div className="graph-sequence__lane-strip" style={{ gridTemplateColumns, width: layout.contentWidth }}>
            <div className="graph-sequence__corner">Time</div>
            {scene.lanes.map((lane) => (
              <header
                key={lane.laneId}
                className={[
                  "graph-sequence__lane-header",
                  activeHighlight && !activeHighlight.laneIds.has(lane.laneId)
                    ? "graph-sequence__lane-header--dimmed"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="graph-sequence__lane-title">
                  <strong>{lane.name}</strong>
                  <StatusChip status={lane.status} subtle />
                </div>
                <span>
                  {lane.role} · {lane.model}
                </span>
                <small>{lane.badge}</small>
              </header>
            ))}
          </div>

          <div
            className="graph-sequence__content"
            style={{ width: layout.contentWidth, minHeight: layout.contentHeight }}
          >
            <svg
              className="graph-sequence__overlay"
              viewBox={`0 0 ${layout.contentWidth} ${layout.contentHeight}`}
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
                  className={[
                    "graph-sequence__lifeline",
                    activeHighlight && !activeHighlight.laneIds.has(lane.laneId)
                      ? "graph-sequence__lifeline--dimmed"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  x1={layout.laneCenterById.get(lane.laneId) ?? 0}
                  y1={0}
                  x2={layout.laneCenterById.get(lane.laneId) ?? 0}
                  y2={layout.contentHeight}
                />
              ))}

              {scene.rows.map((row) =>
                row.kind === "event" ? (
                  <circle
                    key={`anchor-${row.eventId}`}
                    className={[
                      "graph-sequence__anchor",
                      `graph-sequence__anchor--${row.status}`,
                      row.selected ? "graph-sequence__anchor--selected" : "",
                      activeHighlight && !activeHighlight.eventIds.has(row.eventId)
                        ? "graph-sequence__anchor--dimmed"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    cx={layout.eventById.get(row.eventId)?.anchorX ?? 0}
                    cy={layout.eventById.get(row.eventId)?.anchorY ?? 0}
                    r={6}
                  />
                ) : null,
              )}

              {layout.edgeRoutes.map((route) => {
                const bundle = scene.edgeBundles.find((item) => item.id === route.bundleId);
                if (!bundle) {
                  return null;
                }

                const active =
                  activeHighlight?.bundleIds.has(bundle.id) ?? false;
                const dimmed =
                  activeHighlight !== null && !activeHighlight.bundleIds.has(bundle.id);

                return (
                  <g
                    key={bundle.id}
                    className={[
                      "graph-sequence__route",
                      `graph-sequence__route--${bundle.edgeType}`,
                      bundle.inPath ? "graph-sequence__route--path" : "",
                      bundle.selected ? "graph-sequence__route--selected" : "",
                      active ? "graph-sequence__route--active" : "",
                      dimmed ? "graph-sequence__route--dimmed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <path d={route.path} markerEnd={`url(#${routeMarkerId})`} />
                    <circle cx={route.targetX} cy={route.targetY} r={4} />
                  </g>
                );
              })}
            </svg>

            <div className="graph-sequence__rows">
              {scene.rows.map((row) =>
                row.kind === "gap" ? (
                  <div
                    key={row.id}
                    className="graph-sequence__gap-row"
                    style={{ gridTemplateColumns }}
                  >
                    <div className="graph-sequence__time graph-sequence__time--gap">Gap</div>
                    <div
                      className="graph-sequence__gap-band"
                      style={{ gridColumn: `2 / span ${scene.lanes.length || 1}` }}
                    >
                      {row.label}
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="graph-sequence__event-row"
                    style={{ gridTemplateColumns }}
                  >
                    <div className="graph-sequence__time">
                      <strong>{row.timeLabel}</strong>
                      <span>{row.durationLabel}</span>
                    </div>
                    {scene.lanes.map((lane) => {
                      const active =
                        activeHighlight?.eventIds.has(row.eventId) ??
                        false;
                      const laneActive =
                        activeHighlight?.laneIds.has(lane.laneId) ??
                        false;

                      return (
                        <div
                          key={`${row.id}:${lane.laneId}`}
                          className={[
                            "graph-sequence__lane-cell",
                            lane.laneId === row.laneId ? "graph-sequence__lane-cell--occupied" : "",
                            activeHighlight && !laneActive ? "graph-sequence__lane-cell--dimmed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {lane.laneId === row.laneId ? (
                            <button
                              type="button"
                              className={[
                                "graph-sequence__card",
                                row.selected ? "graph-sequence__card--selected" : "",
                                row.inPath ? "graph-sequence__card--path" : "",
                                row.dimmed ? "graph-sequence__card--path-dimmed" : "",
                                active ? "graph-sequence__card--active" : "",
                                activeHighlight && !active ? "graph-sequence__card--dimmed" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => onSelect({ kind: "event", id: row.eventId })}
                              onMouseEnter={() =>
                                setActiveSelection({ kind: "event", id: row.eventId })
                              }
                              onMouseLeave={() => setActiveSelection(null)}
                              onFocus={() => setActiveSelection({ kind: "event", id: row.eventId })}
                              onBlur={() => setActiveSelection(null)}
                              aria-label={`${row.title} ${row.status}`}
                            >
                              <div className="graph-sequence__card-head">
                                <strong>{row.title}</strong>
                                <StatusChip status={row.status} subtle />
                              </div>
                              <p>{row.summary}</p>
                              {row.waitReason ? (
                                <span className="graph-sequence__callout">
                                  wait_reason: {row.waitReason}
                                </span>
                              ) : null}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
            </div>

            {layout.edgeRoutes.map((route) => {
              const bundle = scene.edgeBundles.find((item) => item.id === route.bundleId);
              if (!bundle) {
                return null;
              }

              const active =
                activeHighlight?.bundleIds.has(bundle.id) ?? false;

              return (
                <button
                  key={`hotspot-${route.bundleId}`}
                  type="button"
                  className={[
                    "graph-sequence__edge-hotspot",
                    `graph-sequence__edge-hotspot--${bundle.edgeType}`,
                    bundle.selected ? "graph-sequence__edge-hotspot--selected" : "",
                    active ? "graph-sequence__edge-hotspot--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: `${route.hotspotX - 16}px`,
                    top: `${route.hotspotY - 16}px`,
                  }}
                  aria-label={`${bundle.edgeType} edge between ${bundle.sourceEventId} and ${bundle.targetEventId}`}
                  onClick={() => {
                    if (followLive && liveMode === "live") {
                      onPauseFollowLive();
                    }
                    onSelect({ kind: "edge", id: bundle.primaryEdgeId });
                  }}
                  onMouseEnter={() =>
                    setActiveSelection({ kind: "edge", id: bundle.primaryEdgeId })
                  }
                  onMouseLeave={() => setActiveSelection(null)}
                  onFocus={() => setActiveSelection({ kind: "edge", id: bundle.primaryEdgeId })}
                  onBlur={() => setActiveSelection(null)}
                >
                  <span>{bundle.bundleCount > 1 ? bundle.bundleCount : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function buildGraphLayoutSnapshot(scene: GraphSceneModel): GraphLayoutSnapshot {
  const laneCenterById = new Map<string, number>();
  const eventById = new Map<string, EventLayout>();

  scene.lanes.forEach((lane, index) => {
    laneCenterById.set(lane.laneId, TIME_GUTTER + index * LANE_WIDTH + LANE_WIDTH / 2);
  });

  let cursorY = 0;
  scene.rows.forEach((row, index) => {
    const height = row.kind === "gap" ? GAP_ROW_HEIGHT : EVENT_ROW_HEIGHT;
    if (row.kind === "event") {
      const anchorX = laneCenterById.get(row.laneId) ?? TIME_GUTTER;
      const anchorY = cursorY + ANCHOR_OFFSET_Y;
      eventById.set(row.eventId, {
        eventId: row.eventId,
        laneId: row.laneId,
        anchorX,
        anchorY,
        cardRect: {
          x: anchorX - 92,
          y: cursorY + 36,
          width: 184,
          height: 88,
        },
      });
    }

    cursorY += height;
    if (index < scene.rows.length - 1) {
      cursorY += ROW_GAP;
    }
  });

  const edgeRoutes = scene.edgeBundles.flatMap((bundle) => {
    const source = eventById.get(bundle.sourceEventId);
    const target = eventById.get(bundle.targetEventId);
    if (!source || !target || bundle.sourceLaneId === bundle.targetLaneId) {
      return [];
    }

    const deltaY = target.anchorY - source.anchorY;
    const bridgeY =
      source.anchorY +
      (deltaY >= 0 ? 1 : -1) * Math.min(Math.max(Math.abs(deltaY) * 0.4, 28), 88);

    return [
      {
        bundleId: bundle.id,
        edgeType: bundle.edgeType,
        path: [
          `M ${source.anchorX} ${source.anchorY}`,
          `L ${source.anchorX} ${bridgeY}`,
          `L ${target.anchorX} ${bridgeY}`,
          `L ${target.anchorX} ${target.anchorY}`,
        ].join(" "),
        hotspotX: source.anchorX + (target.anchorX - source.anchorX) / 2,
        hotspotY: bridgeY,
        targetX: target.anchorX,
        targetY: target.anchorY,
      } satisfies EdgeRouteLayout,
    ];
  });

  return {
    contentWidth: TIME_GUTTER + scene.lanes.length * LANE_WIDTH,
    contentHeight: Math.max(cursorY, EVENT_ROW_HEIGHT),
    laneCenterById,
    eventById,
    edgeRoutes,
  };
}

function buildActiveHighlight(
  scene: GraphSceneModel,
  selection: SelectionState | null,
): ActiveHighlight | null {
  if (!selection) {
    return null;
  }

  const eventIds = new Set<string>();
  const bundleIds = new Set<string>();
  const laneIds = new Set<string>();
  const rowsByEventId = new Map(
    scene.rows
      .filter((row) => row.kind === "event")
      .map((row) => [row.eventId, row]),
  );
  const orderedEventIdsByLane = new Map<string, string[]>();

  scene.rows.forEach((row) => {
    if (row.kind !== "event") {
      return;
    }
    orderedEventIdsByLane.set(row.laneId, [
      ...(orderedEventIdsByLane.get(row.laneId) ?? []),
      row.eventId,
    ]);
  });

  const activateEvent = (eventId: string) => {
    const row = rowsByEventId.get(eventId);
    if (!row) {
      return;
    }

    eventIds.add(eventId);
    laneIds.add(row.laneId);

    const laneEvents = orderedEventIdsByLane.get(row.laneId) ?? [];
    const eventIndex = laneEvents.indexOf(eventId);
    const previousEventId = eventIndex > 0 ? laneEvents[eventIndex - 1] : null;
    const nextEventId =
      eventIndex >= 0 && eventIndex < laneEvents.length - 1 ? laneEvents[eventIndex + 1] : null;
    if (previousEventId) {
      eventIds.add(previousEventId);
    }
    if (nextEventId) {
      eventIds.add(nextEventId);
    }

    scene.edgeBundles.forEach((bundle) => {
      if (bundle.sourceEventId !== eventId && bundle.targetEventId !== eventId) {
        return;
      }

      bundleIds.add(bundle.id);
      eventIds.add(bundle.sourceEventId);
      eventIds.add(bundle.targetEventId);
      laneIds.add(bundle.sourceLaneId);
      laneIds.add(bundle.targetLaneId);
    });
  };

  if (selection.kind === "event") {
    activateEvent(selection.id);
    return { eventIds, bundleIds, laneIds };
  }

  if (selection.kind === "edge") {
    const bundle = scene.edgeBundles.find(
      (item) => item.primaryEdgeId === selection.id || item.edgeIds.includes(selection.id),
    );
    if (!bundle) {
      return null;
    }

    bundleIds.add(bundle.id);
    activateEvent(bundle.sourceEventId);
    activateEvent(bundle.targetEventId);
    return { eventIds, bundleIds, laneIds };
  }

  return null;
}
