import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { GlassSurface } from "@/app/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp, type SessionSummary } from "@/entities/session";
import {
  createInitialTimelineViewport,
  disableTimelineFollow,
  refollowLatest,
  timelineContentHeight,
  timelineItemPosition,
  timelineSpanHeight,
  timelineTickLabels,
  zoomTimelineViewport,
} from "../model/viewport";
import type {
  TimelineItemView,
  TimelineMode,
  TimelineProjection,
  TimelineSelection,
  TimelineViewportState,
} from "../model/types";
import { Activity, Clock3, Eye, EyeOff, ScanSearch } from "lucide-react";

interface TimelineCanvasProps {
  errorMessage?: string | null;
  loading?: boolean;
  mode: TimelineMode;
  onSelectionChange: (selection: TimelineSelection) => void;
  projection: TimelineProjection | null;
  selectedItem: TimelineItemView | null;
  selectedSession: SessionSummary | null;
  selection: TimelineSelection;
}

const PANEL_CARD_CLASS =
  "relative flex h-full flex-1 flex-col gap-0 overflow-hidden border-0 bg-transparent shadow-none ring-0";
const PANEL_AMBIENCE_CLASS =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(148,163,184,0.14),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_58%_58%,rgba(2,132,199,0.08),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.016)_34%,transparent_72%)] opacity-90";
const AXIS_WIDTH = 104;
const HEADER_HEIGHT = 68;
const ITEM_WIDTH = 180;
const LANE_WIDTH = 208;
const MIN_VIEWPORT_HEIGHT = 520;

type DragState = {
  pointerId: number;
  startScrollLeft: number;
  startScrollTop: number;
  startX: number;
  startY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTick(ms: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs <= 0) {
    return "point";
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

function itemTone(item: TimelineItemView) {
  switch (item.kind) {
    case "reasoning":
      return {
        accent: "text-emerald-100",
        badge: "Reasoning",
        panel:
          "border-emerald-200/18 bg-[linear-gradient(180deg,rgba(8,47,73,0.62),rgba(4,18,32,0.8))] shadow-[0_0_0_1px_rgba(167,243,208,0.08),0_18px_36px_rgba(6,24,38,0.24)]",
      };
    case "tool":
      return {
        accent: "text-sky-100",
        badge: "Tool",
        panel:
          "border-sky-200/18 bg-[linear-gradient(180deg,rgba(12,74,110,0.6),rgba(8,24,44,0.82))] shadow-[0_0_0_1px_rgba(186,230,253,0.08),0_18px_36px_rgba(8,23,42,0.22)]",
      };
    case "error":
      return {
        accent: "text-rose-100",
        badge: "Error",
        panel:
          "border-rose-200/18 bg-[linear-gradient(180deg,rgba(120,24,54,0.58),rgba(46,12,24,0.82))] shadow-[0_0_0_1px_rgba(254,205,211,0.08),0_18px_36px_rgba(30,10,18,0.24)]",
      };
    case "status":
      return {
        accent: "text-amber-100",
        badge: "Status",
        panel:
          "border-amber-200/18 bg-[linear-gradient(180deg,rgba(120,53,15,0.52),rgba(37,18,8,0.82))] shadow-[0_0_0_1px_rgba(253,230,138,0.08),0_18px_36px_rgba(26,17,11,0.22)]",
      };
    default:
      return {
        accent: "text-slate-100",
        badge: item.kind === "message" ? "Event" : "Item",
        panel:
          "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(6,11,20,0.84))] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_36px_rgba(2,6,23,0.22)]",
      };
  }
}

function viewportCopy(viewport: TimelineViewportState | null, mode: TimelineMode) {
  if (!viewport) {
    return {
      badge: mode === "live" ? "Live focus" : "Archive fit",
      body: mode === "live" ? "Awaiting detail payload" : "Fit-all preset ready",
    };
  }

  if (mode === "archive") {
    return {
      badge: "Archive fit",
      body: "Full session visible by default",
    };
  }

  return viewport.followLatest
    ? {
        badge: "Following latest",
        body: "New live updates keep the viewport pinned to the newest sequence",
      }
    : {
        badge: "Manual review",
        body: "Follow is paused until you resume the latest view",
      };
}

function timelineBodyCopy(options: {
  errorMessage?: string | null;
  loading?: boolean;
  projection: TimelineProjection | null;
  selectedSession: SessionSummary | null;
}) {
  const { errorMessage, loading, projection, selectedSession } = options;

  if (loading) {
    return {
      body: "Loading selected session detail.",
      title: "Timeline is hydrating the latest canonical events.",
    };
  }

  if (errorMessage) {
    return {
      body: errorMessage,
      title: "Detail query failed. Timeline rendering is paused.",
    };
  }

  if (!selectedSession) {
    return {
      body: "Select a session from the sidebar to inspect its vertical sequence timeline.",
      title: "No active session context",
    };
  }

  if (!projection || projection.items.length === 0) {
    return {
      body: "The session exists, but there are no projected timeline items to render yet.",
      title: selectedSession.title ?? "No projected events",
    };
  }

  return null;
}

export function TimelineCanvas({
  errorMessage = null,
  loading = false,
  mode,
  onSelectionChange,
  projection,
  selectedItem,
  selectedSession,
  selection,
}: TimelineCanvasProps) {
  const deferredProjection = useDeferredValue(projection);
  const [viewportHeight, setViewportHeight] = useState(MIN_VIEWPORT_HEIGHT);
  const [viewport, setViewport] = useState<TimelineViewportState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  const emptyState = timelineBodyCopy({
    errorMessage,
    loading,
    projection: deferredProjection,
    selectedSession,
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const syncViewportHeight = () => {
      setViewportHeight(Math.max(node.clientHeight, MIN_VIEWPORT_HEIGHT));
    };

    syncViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncViewportHeight);
      return () => {
        window.removeEventListener("resize", syncViewportHeight);
      };
    }

    const observer = new ResizeObserver(() => {
      syncViewportHeight();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!deferredProjection) {
      previousSessionIdRef.current = null;
      setViewport(null);
      return;
    }

    setViewport((current) => {
      const nextSessionId = deferredProjection.session.session_id;
      const nextContentHeight = current
        ? timelineContentHeight(deferredProjection, current.pixelsPerMs)
        : 0;
      const isNewSession = previousSessionIdRef.current !== nextSessionId;
      previousSessionIdRef.current = nextSessionId;

      if (!current || current.mode !== mode || isNewSession) {
        return createInitialTimelineViewport(deferredProjection, mode, viewportHeight);
      }

      if (current.followLatest) {
        return refollowLatest(deferredProjection, current, viewportHeight);
      }

      return {
        ...current,
        scrollTop: clamp(current.scrollTop, 0, Math.max(nextContentHeight - viewportHeight, 0)),
      };
    });
  }, [deferredProjection, mode, viewportHeight]);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !viewport) {
      return;
    }

    if (Math.abs(node.scrollTop - viewport.scrollTop) < 1) {
      return;
    }

    syncingScrollRef.current = true;
    node.scrollTop = viewport.scrollTop;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [viewport]);

  const handleScroll = useEffectEvent((event: ReactUIEvent<HTMLDivElement>) => {
    if (syncingScrollRef.current) {
      return;
    }

    setViewport((current) =>
      current ? disableTimelineFollow(current, event.currentTarget.scrollTop) : current,
    );
  });

  const handleWheel = useEffectEvent((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!deferredProjection || !viewport || !(event.ctrlKey || event.metaKey)) {
      return;
    }

    event.preventDefault();

    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorY = event.clientY - bounds.top;

    setViewport(
      zoomTimelineViewport({
        anchorY,
        deltaY: event.deltaY,
        projection: deferredProjection,
        viewport,
        viewportHeight,
      }),
    );
  });

  const handlePointerDown = useEffectEvent((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-timeline-item]")) {
      return;
    }

    const node = scrollRef.current;
    if (!node) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startScrollLeft: node.scrollLeft,
      startScrollTop: node.scrollTop,
      startX: event.clientX,
      startY: event.clientY,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  });

  const handlePointerMove = useEffectEvent((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const node = scrollRef.current;
    if (!dragState || !node || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextScrollTop = clamp(
      dragState.startScrollTop - (event.clientY - dragState.startY),
      0,
      node.scrollHeight - node.clientHeight,
    );
    const nextScrollLeft = clamp(
      dragState.startScrollLeft - (event.clientX - dragState.startX),
      0,
      node.scrollWidth - node.clientWidth,
    );

    syncingScrollRef.current = true;
    node.scrollTop = nextScrollTop;
    node.scrollLeft = nextScrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });

    setViewport((current) => (current ? disableTimelineFollow(current, nextScrollTop) : current));
  });

  const handlePointerEnd = useEffectEvent((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  });

  const handleRefollow = useEffectEvent(() => {
    if (!deferredProjection || !viewport) {
      return;
    }

    setViewport(refollowLatest(deferredProjection, viewport, viewportHeight));
  });

  const latestCopy = viewportCopy(viewport, mode);
  const laneCount = deferredProjection?.lanes.length ?? 0;
  const contentHeight =
    deferredProjection && viewport
      ? timelineContentHeight(deferredProjection, viewport.pixelsPerMs)
      : MIN_VIEWPORT_HEIGHT;
  const contentWidth = AXIS_WIDTH + Math.max(laneCount, 1) * LANE_WIDTH + 40;
  const ticks =
    deferredProjection != null ? timelineTickLabels(deferredProjection, mode === "live" ? 5 : 7) : [];

  return (
    <GlassSurface
      refraction="none"
      variant="panel"
      className="flex h-full min-h-[520px] flex-col overflow-hidden"
    >
      <Card className={PANEL_CARD_CLASS}>
        <div aria-hidden="true" className={PANEL_AMBIENCE_CLASS} />
        <CardHeader className="relative z-10 bg-transparent px-6 pb-4 pt-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-emerald-300/92">
                  <Activity className="h-3.5 w-3.5" />
                  Vertical sequence timeline
                </div>
                <CardTitle className="text-[1.7rem] font-normal tracking-tight text-white">
                  {selectedSession?.title ?? "No active session context"}
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm text-slate-300/70">
                  {latestCopy.body}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {selection.kind === "item" ? (
                  <GlassSurface className="rounded-full" refraction="none" variant="control">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-[inherit] border-0 bg-transparent px-3 text-[11px] font-medium text-slate-100 hover:bg-transparent hover:text-white"
                      onClick={() => onSelectionChange({ kind: "session" })}
                    >
                      Session summary
                    </Button>
                  </GlassSurface>
                ) : null}

                {mode === "live" ? (
                  <GlassSurface className="rounded-full" refraction="none" variant="control">
                    <Button
                      aria-pressed={viewport?.followLatest ?? false}
                      data-testid="timeline-refollow-button"
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-[inherit] border-0 bg-transparent px-3 text-[11px] font-medium text-slate-100 hover:bg-transparent hover:text-white"
                      onClick={handleRefollow}
                    >
                      {viewport?.followLatest ? (
                        <Eye className="h-3.5 w-3.5 text-emerald-200" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-amber-200" />
                      )}
                      {viewport?.followLatest ? "Following latest" : "Resume latest follow"}
                    </Button>
                  </GlassSurface>
                ) : null}

                <GlassSurface className="rounded-full" refraction="none" variant="control">
                  <div
                    className="px-3 py-2 text-[11px] font-medium tracking-[0.01em] text-emerald-200"
                    data-testid="timeline-follow-state"
                  >
                    {latestCopy.badge}
                  </div>
                </GlassSurface>
                <GlassSurface className="rounded-full" refraction="none" variant="control">
                  <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono tracking-[0.12em] text-slate-100">
                    <Clock3 className="h-3.5 w-3.5 text-sky-300" />
                    {selectedSession
                      ? formatTimestamp(selectedSession.last_event_at)
                      : "Awaiting selection"}
                  </div>
                </GlassSurface>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>{laneCount > 0 ? `${laneCount} lanes` : "No lanes"}</span>
              <span className="text-slate-500">/</span>
              <span>
                {selectedItem ? `Focused on ${selectedItem.label}` : "Session summary selected"}
              </span>
              <span className="text-slate-500">/</span>
              <span>{mode === "live" ? "Recent zoom preset" : "Fit-all preset"}</span>
              {mode === "live" ? (
                <>
                  <span className="text-slate-500">/</span>
                  <span>Scroll to scrub, pinch or Ctrl+wheel to zoom</span>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 flex flex-1 overflow-hidden bg-transparent p-0">
          {emptyState ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <GlassSurface
                className="max-w-lg rounded-[1.6rem]"
                refraction="none"
                variant="control"
              >
                <div className="space-y-3 px-5 py-5 text-center">
                  <ScanSearch className="mx-auto h-5 w-5 text-slate-400" />
                  <p className="text-base text-white">{emptyState.title}</p>
                  <p className="text-sm leading-relaxed text-slate-300/72">{emptyState.body}</p>
                </div>
              </GlassSurface>
            </div>
          ) : deferredProjection && viewport ? (
            <div className="flex min-h-0 flex-1">
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-auto no-scrollbar"
                data-follow-latest={viewport.followLatest ? "true" : "false"}
                data-testid="timeline-scroll-area"
                onPointerCancel={handlePointerEnd}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onScroll={handleScroll}
                onWheel={handleWheel}
              >
                <div
                  className="relative"
                  style={{
                    height: contentHeight + HEADER_HEIGHT + 20,
                    minWidth: contentWidth,
                  }}
                >
                  <div
                    className="sticky top-0 z-20 grid border-b border-white/6 bg-[linear-gradient(180deg,rgba(8,12,22,0.92),rgba(8,12,22,0.75))] backdrop-blur-xl"
                    style={{
                      gridTemplateColumns: `${AXIS_WIDTH}px repeat(${Math.max(laneCount, 1)}, ${LANE_WIDTH}px)`,
                      height: HEADER_HEIGHT,
                    }}
                  >
                    <div className="flex flex-col justify-center px-4 text-[10px] font-medium tracking-[0.08em] text-slate-500">
                      Time
                    </div>
                    {deferredProjection.lanes.map((lane) => (
                      <div
                        key={lane.laneId}
                        className="flex items-center border-l border-white/5 px-4"
                      >
                        <div className="w-full rounded-[1rem] border border-white/6 bg-white/[0.035] px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            {lane.column}
                          </p>
                          <p className="mt-1 text-sm text-white">{lane.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <svg
                    aria-hidden="true"
                    className="absolute left-0 top-0"
                    height={contentHeight + HEADER_HEIGHT + 20}
                    width={contentWidth}
                  >
                    {ticks.map((tickMs) => {
                      const y =
                        HEADER_HEIGHT +
                        timelineItemPosition(deferredProjection, tickMs, viewport.pixelsPerMs);
                      return (
                        <g key={tickMs}>
                          <line
                            stroke="rgba(148,163,184,0.14)"
                            strokeDasharray="4 8"
                            strokeWidth="1"
                            x1={AXIS_WIDTH - 8}
                            x2={contentWidth - 24}
                            y1={y}
                            y2={y}
                          />
                          <text
                            fill="rgba(148,163,184,0.7)"
                            fontFamily="IBM Plex Mono, monospace"
                            fontSize="10"
                            x={18}
                            y={y + 4}
                          >
                            {formatTick(tickMs)}
                          </text>
                        </g>
                      );
                    })}

                    {deferredProjection.lanes.map((lane, index) => {
                      const laneCenter = AXIS_WIDTH + index * LANE_WIDTH + LANE_WIDTH / 2;
                      return (
                        <g key={lane.laneId}>
                          <line
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1.2"
                            x1={laneCenter}
                            x2={laneCenter}
                            y1={HEADER_HEIGHT}
                            y2={contentHeight + HEADER_HEIGHT}
                          />
                          <rect
                            fill={`url(#lane-${index})`}
                            height={contentHeight}
                            rx={28}
                            width={LANE_WIDTH - 26}
                            x={laneCenter - (LANE_WIDTH - 26) / 2}
                            y={HEADER_HEIGHT + 14}
                          />
                          <defs>
                            <linearGradient id={`lane-${index}`} x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
                              <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                            </linearGradient>
                          </defs>
                        </g>
                      );
                    })}
                  </svg>

                  {deferredProjection.items.map((item) => {
                    const laneIndex = deferredProjection.lanes.findIndex(
                      (lane) => lane.laneId === item.laneId,
                    );
                    const lane = deferredProjection.lanes[laneIndex];
                    const laneCenter = AXIS_WIDTH + laneIndex * LANE_WIDTH + LANE_WIDTH / 2;
                    const durationMs =
                      item.endedAtMs != null ? Math.max(item.endedAtMs - item.startedAtMs, 0) : null;
                    const isPointItem = durationMs == null || durationMs <= 0;
                    const height = isPointItem
                      ? 58
                      : Math.max(timelineSpanHeight(durationMs, viewport.pixelsPerMs), 88);
                    const top =
                      HEADER_HEIGHT +
                      timelineItemPosition(
                        deferredProjection,
                        item.startedAtMs,
                        viewport.pixelsPerMs,
                      );
                    const tone = itemTone(item);
                    const isSelected =
                      selection.kind === "item" && selection.itemId === item.itemId;

                    return (
                      <button
                        key={item.itemId}
                        aria-label={item.label}
                        aria-pressed={isSelected}
                        className={`absolute z-10 overflow-hidden rounded-[1.25rem] border text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-white/18 focus-visible:ring-[3px] focus-visible:ring-sky-200/30 focus-visible:outline-none ${
                          tone.panel
                        } ${
                          isSelected
                            ? "border-sky-200/38 shadow-[0_0_0_1px_rgba(191,219,254,0.22),0_0_0_8px_rgba(56,189,248,0.14),0_18px_42px_rgba(2,6,23,0.28)]"
                            : ""
                        }`}
                        data-kind={item.kind}
                        data-timeline-item=""
                        style={{
                          height,
                          left: laneCenter - ITEM_WIDTH / 2,
                          top,
                          width: ITEM_WIDTH,
                        }}
                        type="button"
                        onClick={() =>
                          onSelectionChange(
                            isSelected ? { kind: "session" } : { itemId: item.itemId, kind: "item" },
                          )
                        }
                      >
                        <div className="flex h-full flex-col justify-between gap-2 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-[11px] font-medium ${tone.accent}`}>
                                {item.label}
                              </p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                                {isPointItem ? "Point" : tone.badge}
                              </p>
                            </div>
                            {(item.tokenInput > 0 || item.tokenOutput > 0) && (
                              <span className="rounded-full border border-white/8 bg-white/[0.055] px-2 py-1 text-[9px] font-mono text-slate-200">
                                {item.tokenInput + item.tokenOutput} tok
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-200/84">
                              {item.summary ?? item.payloadPreview ?? "No summary available"}
                            </p>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                              <span>{lane?.label ?? item.laneId}</span>
                              <span>{formatDuration(durationMs)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </GlassSurface>
  );
}
