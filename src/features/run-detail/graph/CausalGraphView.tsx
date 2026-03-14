import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { GraphSceneModel, LiveMode, SelectionState } from "../../../shared/domain";
import { Panel, StatusChip } from "../../../shared/ui";
import {
  buildContinuationGuideYs,
  buildGraphLayoutSnapshot,
  computeRenderedContentHeight,
  EVENT_ROW_HEIGHT,
  GAP_ROW_HEIGHT,
  ROW_GAP,
  TIME_GUTTER,
} from "./graphLayout";

interface CausalGraphViewProps {
  scene: GraphSceneModel;
  onSelect: (selection: SelectionState) => void;
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  viewportHeightOverride?: number;
  laneHeaderHeightOverride?: number;
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
  viewportHeightOverride,
  laneHeaderHeightOverride,
}: CausalGraphViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneStripRef = useRef<HTMLDivElement>(null);
  const [activeSelection, setActiveSelection] = useState<SelectionState | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(viewportHeightOverride ?? 0);
  const [laneHeaderHeight, setLaneHeaderHeight] = useState(laneHeaderHeightOverride ?? 0);
  const layout = buildGraphLayoutSnapshot(scene, viewportWidth);
  const activeHighlight = buildActiveHighlight(scene, activeSelection);
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
    <Panel title="Graph" className="canvas-panel graph-sequence-panel">
      {scene.hiddenLaneCount ? (
        <p className="graph-panel__collapsed-copy">
          {scene.hiddenLaneCount} inactive done lanes are folded to preserve the active path.
        </p>
      ) : null}
      <div
        ref={viewportRef}
        className="graph-sequence"
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
        <div ref={scrollRef} className="graph-sequence__scroll" onScroll={handleScroll}>
          <div
            ref={laneStripRef}
            className="graph-sequence__lane-strip"
            style={{ gridTemplateColumns, width: layout.contentWidth }}
          >
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
            style={{ width: layout.contentWidth, minHeight: renderedContentHeight }}
          >
            <svg
              className="graph-sequence__overlay graph-sequence__overlay--visible"
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
                  y2={renderedContentHeight}
                />
              ))}

              {scene.rows.map((row) => {
                if (row.kind !== "event") {
                  return null;
                }

                const guideY = layout.rowGuideYByEventId.get(row.eventId);
                if (guideY === undefined) {
                  return null;
                }

                const active =
                  activeHighlight?.eventIds.has(row.eventId) ??
                  false;
                const dimmed =
                  activeHighlight !== null && !active;

                return (
                  <line
                    key={`guide-${row.eventId}`}
                    className={[
                      "graph-sequence__row-guide",
                      row.selected ? "graph-sequence__row-guide--selected" : "",
                      row.inPath || active ? "graph-sequence__row-guide--active" : "",
                      dimmed ? "graph-sequence__row-guide--dimmed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    x1={TIME_GUTTER}
                    y1={guideY}
                    x2={layout.contentWidth}
                    y2={guideY}
                  />
                );
              })}

              {continuationGuideYs.map((guideY) => (
                <line
                  key={`continuation-guide-${guideY}`}
                  className="graph-sequence__row-guide graph-sequence__row-guide--continuation"
                  x1={TIME_GUTTER}
                  y1={guideY}
                  x2={layout.contentWidth}
                  y2={guideY}
                />
              ))}

              {layout.edgeRoutes.map((route) => {
                const bundle = bundleById.get(route.bundleId);
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
                    <circle
                      className="graph-sequence__route-port"
                      cx={route.sourcePort.x}
                      cy={route.sourcePort.y}
                      r={4}
                    />
                    <circle
                      className="graph-sequence__route-port"
                      cx={route.targetPort.x}
                      cy={route.targetPort.y}
                      r={4}
                    />
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
                      <div className="graph-sequence__time-stack">
                        <strong>{row.timeLabel}</strong>
                        <span>{row.durationLabel}</span>
                      </div>
                    </div>
                    {scene.lanes.map((lane) => {
                      const active =
                        activeHighlight?.eventIds.has(row.eventId) ??
                        false;
                      const laneActive =
                        activeHighlight?.laneIds.has(lane.laneId) ??
                        false;
                      const eventLayout = layout.eventById.get(row.eventId);

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
                              style={
                                eventLayout
                                  ? {
                                      top: `${eventLayout.cardRect.y - eventLayout.rowTop}px`,
                                      width: `${eventLayout.cardRect.width}px`,
                                    }
                                  : undefined
                              }
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
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
            </div>

            <svg
              className="graph-sequence__overlay graph-sequence__overlay--interactive"
              viewBox={`0 0 ${layout.contentWidth} ${renderedContentHeight}`}
              preserveAspectRatio="none"
            >
              <title>Interactive graph edge hit targets</title>
              {layout.edgeRoutes.map((route) => {
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
                    onMouseEnter={() =>
                      setActiveSelection({ kind: "edge", id: bundle.primaryEdgeId })
                    }
                    onMouseLeave={() => setActiveSelection(null)}
                    onFocus={() => setActiveSelection({ kind: "edge", id: bundle.primaryEdgeId })}
                    onBlur={() => setActiveSelection(null)}
                  >
                    <title>{bundle.edgeType}: {bundle.label}</title>
                    <path className="graph-sequence__route-hitbox" d={route.path} />
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
