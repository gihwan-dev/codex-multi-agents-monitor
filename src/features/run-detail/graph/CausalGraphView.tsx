import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { GraphSceneModel, LiveMode, SelectionState } from "../../../shared/domain";
import { EventTypeGlyph, GapChip, Panel, StatusChip } from "../../../shared/ui";
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
} from "./graphLayout";

interface CausalGraphViewProps {
  scene: GraphSceneModel;
  onSelect: (selection: SelectionState) => void;
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  expandedGapIds: Set<string>;
  onToggleGap: (gapId: string) => void;
  viewportHeightOverride?: number;
  laneHeaderHeightOverride?: number;
}

export function CausalGraphView({
  scene,
  onSelect,
  followLive,
  liveMode,
  onPauseFollowLive,
  expandedGapIds,
  onToggleGap,
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
    layout.rowPositions, scrollTop, availableCanvasHeight, 4,
  );
  const visibleRows = scene.rows.slice(visibleRange.startIndex, visibleRange.endIndex);
  const visibleRowPositions = layout.rowPositions.slice(visibleRange.startIndex, visibleRange.endIndex);
  const visibleEdgeRoutes = computeVisibleEdgeRoutes(
    layout.edgeRoutes, scrollTop, availableCanvasHeight, 500,
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
            <div className="graph-sequence__corner">Time (dur)</div>
            {scene.lanes.map((lane) => (
              <header
                key={lane.laneId}
                className="graph-sequence__lane-header"
              >
                <span
                  className={`graph-sequence__lane-corner graph-sequence__lane-corner--${lane.status}`}
                  aria-hidden="true"
                />
                <div className="graph-sequence__lane-title">
                  <strong>{lane.name}</strong>
                  {lane.role !== "session" && lane.role !== "user" ? (
                    <span className="graph-sequence__role-badge">{lane.role}</span>
                  ) : null}
                  <span className="graph-sequence__model-badge">{lane.model}</span>
                </div>
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
                  className="graph-sequence__lifeline"
                  x1={layout.laneCenterById.get(lane.laneId) ?? 0}
                  y1={0}
                  x2={layout.laneCenterById.get(lane.laneId) ?? 0}
                  y2={renderedContentHeight}
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
                    className={[
                      "graph-sequence__row-guide",
                      row.selected ? "graph-sequence__row-guide--selected" : "",
                      row.inPath ? "graph-sequence__row-guide--active" : "",
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

              {continuationGuideYs
                .filter((guideY) => guideY >= scrollTop - 500 && guideY <= scrollTop + availableCanvasHeight + 500)
                .map((guideY) => (
                <line
                  key={`continuation-guide-${guideY}`}
                  className="graph-sequence__row-guide graph-sequence__row-guide--continuation"
                  x1={TIME_GUTTER}
                  y1={guideY}
                  x2={layout.contentWidth}
                  y2={guideY}
                />
              ))}

              {visibleEdgeRoutes.map((route) => {
                const bundle = bundleById.get(route.bundleId);
                if (!bundle) {
                  return null;
                }

                return (
                  <g
                    key={bundle.id}
                    className={[
                      "graph-sequence__route",
                      `graph-sequence__route--${bundle.edgeType}`,
                      bundle.inPath ? "graph-sequence__route--path" : "",
                      bundle.selected ? "graph-sequence__route--selected" : "",
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

            <div className="graph-sequence__rows" style={{ height: renderedContentHeight }}>
              {visibleRows.map((row, visibleIndex) => {
                const rowPos = visibleRowPositions[visibleIndex];
                return row.kind === "gap" ? (
                  <div
                    key={row.id}
                    className={`graph-sequence__gap-separator${expandedGapIds?.has(row.id) ? " graph-sequence__gap-separator--expanded" : ""}`}
                    style={{ gridTemplateColumns, top: rowPos.topY, height: rowPos.height }}
                  >
                    <div className="graph-sequence__time graph-sequence__time--gap" />
                    <div
                      className="graph-sequence__gap-marker"
                      style={{ gridColumn: `2 / span ${scene.lanes.length || 1}` }}
                    >
                      <GapChip
                        gapId={row.id}
                        label={row.label}
                        durationMs={row.durationMs}
                        expanded={expandedGapIds?.has(row.id) ?? false}
                        onToggle={onToggleGap}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="graph-sequence__event-row"
                    style={{ gridTemplateColumns, top: rowPos.topY, height: rowPos.height }}
                  >
                    <div className="graph-sequence__time">
                      <div className="graph-sequence__time-stack">
                        <strong>{row.timeLabel}</strong>
                        <span>({row.durationLabel})</span>
                      </div>
                    </div>
                    {scene.lanes.map((lane) => {
                      const eventLayout = layout.eventById.get(row.eventId);

                      return (
                        <div
                          key={`${row.id}:${lane.laneId}`}
                          className={[
                            "graph-sequence__lane-cell",
                            lane.laneId === row.laneId ? "graph-sequence__lane-cell--occupied" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {lane.laneId === row.laneId ? (
                            <button
                              type="button"
                              className={[
                                "graph-sequence__card",
                                `graph-sequence__card--${row.eventType.replace(".", "-")}`,
                                row.selected ? "graph-sequence__card--selected" : "",
                                row.inPath ? "graph-sequence__card--path" : "",
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
                              aria-label={`${row.title} ${row.status}`}
                            >
                              <div className="graph-sequence__card-head">
                                <span className="graph-sequence__card-title">
                                  <EventTypeGlyph eventType={row.eventType} />
                                  <strong>{row.title}</strong>
                                </span>
                                {row.toolName ? <span className="graph-sequence__tool-badge">{row.toolName}</span> : null}
                                <StatusChip status={row.status} subtle />
                              </div>
                              {row.summary !== "n/a" ? (
                                <p className="graph-sequence__card-summary">{row.summary}</p>
                              ) : null}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <svg
              className="graph-sequence__overlay graph-sequence__overlay--interactive"
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
