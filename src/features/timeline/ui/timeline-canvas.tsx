import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { GlassSurface } from "@/app/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatSessionDisplayTitle,
  formatTimestamp,
  type SessionSummary,
} from "@/entities/session";
import { buildTimelineLiveLayout } from "../model/live-layout";
import { resolveTimelineSelection } from "../model/projection";
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
  TimelineActivationSegment,
  TimelineConnector,
  TimelineItemView,
  TimelineLiveLayout,
  TimelineMode,
  TimelineProjection,
  TimelineSelection,
  TimelineSelectionContext,
  TimelineViewportState,
} from "../model/types";
import { Activity, Clock3, Eye, EyeOff, ScanSearch } from "lucide-react";

interface TimelineCanvasProps {
  errorMessage?: string | null;
  loading?: boolean;
  mode: TimelineMode;
  onSelectionChange: (selection: TimelineSelection) => void;
  projection: TimelineProjection | null;
  selectedSession: SessionSummary | null;
  selection: TimelineSelection;
  selectionContext: TimelineSelectionContext | null;
}

const PANEL_CARD_CLASS =
  "relative flex h-full min-w-0 flex-1 flex-col gap-0 overflow-hidden border-0 bg-transparent shadow-none ring-0";
const PANEL_AMBIENCE_CLASS =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(148,163,184,0.14),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_58%_58%,rgba(2,132,199,0.08),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.016)_34%,transparent_72%)] opacity-90";
const DEFAULT_AXIS_WIDTH = 96;
const DEFAULT_HEADER_HEIGHT = 64;
const DEFAULT_LANE_WIDTH = 208;
const DEFAULT_TURN_INSET = 16;
const DEFAULT_ACTIVATION_WIDTH = 18;
const MIN_VIEWPORT_HEIGHT = 520;

type DragState = {
  pointerId: number;
  startScrollLeft: number;
  startScrollTop: number;
  startX: number;
  startY: number;
};

type DensityMode = "overview" | "diagnostic" | "close";

type StageTone = {
  activation: string;
  activationBorder: string;
  bandFill: string;
  bandStroke: string;
  connector: string;
  glow: string;
  marker: string;
};

type StageMetrics = {
  activationWidth: number;
  axisWidth: number;
  contentInset: number;
  headerHeight: number;
  isCompact: boolean;
  isNarrow: boolean;
  laneCardInset: number;
  laneWidth: number;
  turnInset: number;
  turnHeaderPaddingLeft: number;
  turnHeaderPaddingRight: number;
};

const COLUMN_TONES: Record<"user" | "main" | "other", StageTone> = {
  main: {
    activation: "rgba(16, 185, 129, 0.82)",
    activationBorder: "rgba(167, 243, 208, 0.5)",
    bandFill: "rgba(16, 185, 129, 0.08)",
    bandStroke: "rgba(16, 185, 129, 0.24)",
    connector: "rgba(16, 185, 129, 0.78)",
    glow: "rgba(16, 185, 129, 0.24)",
    marker: "rgba(110, 231, 183, 0.96)",
  },
  other: {
    activation: "rgba(56, 189, 248, 0.84)",
    activationBorder: "rgba(186, 230, 253, 0.5)",
    bandFill: "rgba(14, 165, 233, 0.08)",
    bandStroke: "rgba(56, 189, 248, 0.24)",
    connector: "rgba(56, 189, 248, 0.8)",
    glow: "rgba(56, 189, 248, 0.24)",
    marker: "rgba(125, 211, 252, 0.96)",
  },
  user: {
    activation: "rgba(251, 191, 36, 0.84)",
    activationBorder: "rgba(253, 230, 138, 0.52)",
    bandFill: "rgba(245, 158, 11, 0.12)",
    bandStroke: "rgba(251, 191, 36, 0.3)",
    connector: "rgba(251, 191, 36, 0.78)",
    glow: "rgba(251, 191, 36, 0.2)",
    marker: "rgba(252, 211, 77, 0.96)",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveStageMetrics(options: {
  laneCount: number;
  mode: TimelineMode;
  viewportWidth: number;
}): StageMetrics {
  const { laneCount, mode, viewportWidth } = options;
  if (mode !== "live") {
    return {
      activationWidth: DEFAULT_ACTIVATION_WIDTH,
      axisWidth: DEFAULT_AXIS_WIDTH,
      contentInset: 40,
      headerHeight: DEFAULT_HEADER_HEIGHT,
      isCompact: false,
      isNarrow: false,
      laneCardInset: 17,
      laneWidth: DEFAULT_LANE_WIDTH,
      turnInset: DEFAULT_TURN_INSET,
      turnHeaderPaddingLeft: DEFAULT_AXIS_WIDTH + 20,
      turnHeaderPaddingRight: 24,
    };
  }

  const isNarrow = viewportWidth < 520;
  const isCompact = viewportWidth < 960;
  const axisWidth = isNarrow ? 42 : isCompact ? 72 : DEFAULT_AXIS_WIDTH;
  const contentInset = isNarrow ? 12 : isCompact ? 24 : 40;
  const minLaneWidth = isNarrow ? 70 : isCompact ? 120 : DEFAULT_LANE_WIDTH;
  const laneWidth =
    laneCount > 0
      ? clamp(
          Math.floor((viewportWidth - axisWidth - contentInset) / Math.max(laneCount, 1)),
          minLaneWidth,
          DEFAULT_LANE_WIDTH,
        )
      : DEFAULT_LANE_WIDTH;

  return {
    activationWidth: isNarrow ? 12 : DEFAULT_ACTIVATION_WIDTH,
    axisWidth,
    contentInset,
    headerHeight: isNarrow ? 50 : DEFAULT_HEADER_HEIGHT,
    isCompact,
    isNarrow,
    laneCardInset: isNarrow ? 6 : isCompact ? 14 : 17,
    laneWidth,
    turnInset: isNarrow ? 8 : isCompact ? 12 : DEFAULT_TURN_INSET,
    turnHeaderPaddingLeft: axisWidth + (isNarrow ? 6 : 20),
    turnHeaderPaddingRight: isNarrow ? 8 : 24,
  };
}

function formatTick(ms: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

function densityMode(pixelsPerMs: number): DensityMode {
  if (pixelsPerMs < 0.003) {
    return "overview";
  }

  if (pixelsPerMs < 0.02) {
    return "diagnostic";
  }

  return "close";
}

function connectorStroke(kind: TimelineConnector["kind"]) {
  switch (kind) {
    case "spawn":
      return {
        dashArray: undefined,
        label: "Spawn",
        strokeWidth: 2.2,
      };
    case "handoff":
      return {
        dashArray: undefined,
        label: "Handoff",
        strokeWidth: 1.8,
      };
    case "reply":
      return {
        dashArray: "5 6",
        label: "Reply",
        strokeWidth: 1.8,
      };
    default:
      return {
        dashArray: "4 7",
        label: "Complete",
        strokeWidth: 1.8,
      };
  }
}

function capsuleTone(item: TimelineItemView) {
  if (item.kind === "tool") {
    return {
      badge: "Tool",
      border: "border-sky-200/18",
      body: "bg-[linear-gradient(180deg,rgba(8,47,73,0.92),rgba(6,20,38,0.94))]",
      glow: "shadow-[0_0_0_1px_rgba(186,230,253,0.08),0_12px_24px_rgba(8,23,42,0.28)]",
      text: "text-sky-100",
    };
  }

  return {
    badge: "Reasoning",
    border: "border-emerald-200/18",
    body: "bg-[linear-gradient(180deg,rgba(6,36,31,0.9),rgba(4,22,20,0.94))]",
    glow: "shadow-[0_0_0_1px_rgba(167,243,208,0.08),0_12px_24px_rgba(5,20,18,0.24)]",
    text: "text-emerald-100",
  };
}

function pointTone(item: TimelineItemView) {
  if (item.kind === "error") {
    return {
      dot: "bg-rose-300",
      ring: "ring-rose-200/30",
      text: "text-rose-100",
    };
  }

  if (item.kind === "status") {
    return {
      dot: "bg-amber-300",
      ring: "ring-amber-200/30",
      text: "text-amber-100",
    };
  }

  return {
    dot: "bg-slate-200",
    ring: "ring-white/18",
    text: "text-slate-100",
  };
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
        body: "New live updates keep the stage pinned to the newest sequence",
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
      body: "Select a session from the sidebar to inspect its sequence stage.",
      title: "No active session context",
    };
  }

  if (!projection || projection.items.length === 0) {
    const sessionTitle = formatSessionDisplayTitle({
      rawTitle: selectedSession.title,
      workspacePath: selectedSession.workspace_path,
    });

    return {
      body: "The session exists, but there are no projected timeline items to render yet.",
      title: sessionTitle.displayTitle,
    };
  }

  return null;
}

function laneCenter(index: number, stageMetrics: Pick<StageMetrics, "axisWidth" | "laneWidth">) {
  return stageMetrics.axisWidth + index * stageMetrics.laneWidth + stageMetrics.laneWidth / 2;
}

function connectorPath(
  connector: TimelineConnector,
  laneIndexById: Record<string, number>,
  projection: TimelineProjection,
  pixelsPerMs: number,
  stageMetrics: Pick<StageMetrics, "axisWidth" | "headerHeight" | "laneWidth">,
) {
  const sourceIndex = laneIndexById[connector.sourceLaneId];
  const targetIndex = laneIndexById[connector.targetLaneId];
  const sourceX = laneCenter(sourceIndex, stageMetrics);
  const targetX = laneCenter(targetIndex, stageMetrics);
  const sourceY =
    stageMetrics.headerHeight +
    timelineItemPosition(projection, connector.startedAtMs, pixelsPerMs) +
    6;
  const targetY =
    stageMetrics.headerHeight +
    timelineItemPosition(projection, connector.endedAtMs, pixelsPerMs) +
    6;
  const controlY = sourceY + Math.max((targetY - sourceY) * 0.44, 28);

  return {
    bounds: {
      left: Math.min(sourceX, targetX),
      right: Math.max(sourceX, targetX),
      top: Math.min(sourceY, targetY),
    },
    path: `M ${sourceX} ${sourceY} C ${sourceX} ${controlY}, ${targetX} ${controlY}, ${targetX} ${targetY}`,
    sourceX,
    sourceY,
    targetX,
    targetY,
  };
}

function liveConnectorPath(
  connector: TimelineConnector,
  laneIndexById: Record<string, number>,
  liveLayout: TimelineLiveLayout,
  stageMetrics: Pick<StageMetrics, "axisWidth" | "headerHeight" | "laneWidth">,
) {
  const sourceIndex = laneIndexById[connector.sourceLaneId];
  const targetIndex = laneIndexById[connector.targetLaneId];
  const sourceX = laneCenter(sourceIndex, stageMetrics);
  const targetX = laneCenter(targetIndex, stageMetrics);
  const sourceY =
    stageMetrics.headerHeight + (liveLayout.segmentExitYById[connector.sourceSegmentId] ?? 0);
  const targetY =
    stageMetrics.headerHeight + (liveLayout.segmentEntryYById[connector.targetSegmentId] ?? 0);
  const controlY = sourceY + Math.max((targetY - sourceY) * 0.44, 28);

  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX} ${controlY}, ${targetX} ${controlY}, ${targetX} ${targetY}`,
  };
}

function visibleLiveRenderItemIds(liveLayout: TimelineLiveLayout | null) {
  if (!liveLayout) {
    return new Set<string>();
  }

  return new Set(
    Object.values(liveLayout.renderItemIdsBySegmentId).flatMap((itemIds) => itemIds),
  );
}

function selectionLabel(
  projection: TimelineProjection | null,
  selectionContext: TimelineSelectionContext | null,
) {
  if (!projection || !selectionContext) {
    return "Session summary selected";
  }

  if (selectionContext.selectedConnector) {
    const sourceLane =
      projection.lanes.find((lane) => lane.laneId === selectionContext.selectedConnector?.sourceLaneId)
        ?.label ?? selectionContext.selectedConnector.sourceLaneId;
    const targetLane =
      projection.lanes.find((lane) => lane.laneId === selectionContext.selectedConnector?.targetLaneId)
        ?.label ?? selectionContext.selectedConnector.targetLaneId;
    return `${connectorStroke(selectionContext.selectedConnector.kind).label} · ${sourceLane} -> ${targetLane}`;
  }

  if (selectionContext.selectedSegment) {
    const lane =
      projection.lanes.find((candidate) => candidate.laneId === selectionContext.selectedSegment?.laneId)
        ?.label ?? selectionContext.selectedSegment.laneId;
    return `${lane} activation`;
  }

  if (selectionContext.selectedItem) {
    return selectionContext.selectedItem.label;
  }

  return "Session summary selected";
}

function isCapsuleItem(item: TimelineItemView) {
  return item.kind === "tool" || item.kind === "reasoning";
}

function isLinkedSpawnToolItem(item: TimelineItemView) {
  return (
    item.kind === "tool" &&
    typeof item.meta.linked_spawn_session_id === "string" &&
    item.meta.linked_spawn_session_id.length > 0
  );
}

function isPromptItem(item: TimelineItemView) {
  return item.sourceEvents.some((event) => event.kind === "user_message");
}

function isOverviewVisiblePoint(item: TimelineItemView, segment: TimelineActivationSegment | null) {
  return (
    item.kind === "error" ||
    segment?.terminalItemId === item.itemId ||
    item.sourceEvents.some((event) => event.kind === "turn_aborted" || event.kind === "agent_complete")
  );
}

export function TimelineCanvas({
  errorMessage = null,
  loading = false,
  mode,
  onSelectionChange,
  projection,
  selectedSession,
  selection,
  selectionContext,
}: TimelineCanvasProps) {
  const deferredProjection = useDeferredValue(projection);
  const [hoverSelection, setHoverSelection] = useState<TimelineSelection | null>(null);
  const [viewportHeight, setViewportHeight] = useState(MIN_VIEWPORT_HEIGHT);
  const [viewportWidth, setViewportWidth] = useState(960);
  const [viewport, setViewport] = useState<TimelineViewportState | null>(null);
  const [freshLatest, setFreshLatest] = useState<{ itemId: string | null; segmentId: string | null }>(
    {
      itemId: null,
      segmentId: null,
    },
  );
  const dragStateRef = useRef<DragState | null>(null);
  const previousLatestItemIdRef = useRef<string | null>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  const emptyState = timelineBodyCopy({
    errorMessage,
    loading,
    projection: deferredProjection,
    selectedSession,
  });
  const liveLayout = useMemo(
    () =>
      mode === "live" && deferredProjection ? buildTimelineLiveLayout(deferredProjection) : null,
    [deferredProjection, mode],
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const syncViewportHeight = () => {
      setViewportHeight(Math.max(node.clientHeight, MIN_VIEWPORT_HEIGHT));
      setViewportWidth(Math.max(node.clientWidth, 320));
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
  }, [deferredProjection != null, viewport != null]);

  useEffect(() => {
    if (!deferredProjection) {
      previousSessionIdRef.current = null;
      setViewport(null);
      return;
    }

    setViewport((current) => {
      const nextSessionId = deferredProjection.session.session_id;
      const nextContentHeight = current
        ? timelineContentHeight(deferredProjection, current.pixelsPerMs, liveLayout)
        : 0;
      const isNewSession = previousSessionIdRef.current !== nextSessionId;
      previousSessionIdRef.current = nextSessionId;

      if (!current || current.mode !== mode || isNewSession) {
        return createInitialTimelineViewport(
          deferredProjection,
          mode,
          viewportHeight,
          liveLayout,
        );
      }

      if (current.followLatest) {
        return refollowLatest(deferredProjection, current, viewportHeight, liveLayout);
      }

      return {
        ...current,
        scrollTop: clamp(current.scrollTop, 0, Math.max(nextContentHeight - viewportHeight, 0)),
      };
    });
  }, [deferredProjection, liveLayout, mode, viewportHeight]);

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

  useEffect(() => {
    if (!deferredProjection) {
      previousLatestItemIdRef.current = null;
      setFreshLatest({ itemId: null, segmentId: null });
      return;
    }

    const latestItemId = deferredProjection.latestItemId;
    const isNewSession = previousSessionIdRef.current !== deferredProjection.session.session_id;
    if (!latestItemId || isNewSession) {
      previousLatestItemIdRef.current = latestItemId;
      setFreshLatest({ itemId: null, segmentId: null });
      return;
    }

    if (previousLatestItemIdRef.current && previousLatestItemIdRef.current !== latestItemId) {
      const segmentId = deferredProjection.relationMap.items[latestItemId]?.segmentId ?? null;
      setFreshLatest({ itemId: latestItemId, segmentId });
      const timeoutId = window.setTimeout(() => {
        setFreshLatest({ itemId: null, segmentId: null });
      }, 900);
      previousLatestItemIdRef.current = latestItemId;
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    previousLatestItemIdRef.current = latestItemId;
    return undefined;
  }, [deferredProjection]);

  const handleScroll = useEffectEvent((event: ReactUIEvent<HTMLDivElement>) => {
    if (syncingScrollRef.current) {
      return;
    }

    const nextScrollTop = event.currentTarget.scrollTop;

    setViewport((current) =>
      current ? disableTimelineFollow(current, nextScrollTop) : current,
    );
  });

  const handleWheel = useEffectEvent((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    if (mode === "live") {
      event.preventDefault();
      return;
    }

    if (!deferredProjection || !viewport) {
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
    if ((event.target as HTMLElement).closest("[data-timeline-interactive]")) {
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

    setViewport(refollowLatest(deferredProjection, viewport, viewportHeight, liveLayout));
  });

  const hoverContext = useMemo(
    () => (hoverSelection ? resolveTimelineSelection(deferredProjection, hoverSelection) : null),
    [deferredProjection, hoverSelection],
  );

  const interactionContext =
    hoverContext && hoverSelection?.kind !== "session" ? hoverContext : selectionContext;
  const latestCopy = viewportCopy(viewport, mode);
  const isLiveCompact = mode === "live" && liveLayout != null;
  const laneCount = deferredProjection?.lanes.length ?? 0;
  const stageMetrics = useMemo(
    () => resolveStageMetrics({ laneCount, mode, viewportWidth }),
    [laneCount, mode, viewportWidth],
  );
  const contentHeight =
    deferredProjection && viewport
      ? timelineContentHeight(deferredProjection, viewport.pixelsPerMs, liveLayout)
      : MIN_VIEWPORT_HEIGHT;
  const contentWidth =
    stageMetrics.axisWidth +
    Math.max(laneCount, 1) * stageMetrics.laneWidth +
    stageMetrics.contentInset;
  const ticks =
    deferredProjection != null && !isLiveCompact
      ? timelineTickLabels(deferredProjection, mode === "live" ? 5 : 7)
      : [];
  const currentDensity = !isLiveCompact ? densityMode(viewport?.pixelsPerMs ?? 0) : null;
  const liveFollowLabel = stageMetrics.isNarrow
    ? viewport?.followLatest
      ? "Following"
      : "Resume follow"
    : viewport?.followLatest
      ? "Following latest"
      : "Resume latest follow";
  const laneIndexById = useMemo(
    () =>
      Object.fromEntries(
        (deferredProjection?.lanes ?? []).map((lane, index) => [lane.laneId, index]),
      ) as Record<string, number>,
    [deferredProjection],
  );
  const liveRenderItemIds = useMemo(() => visibleLiveRenderItemIds(liveLayout), [liveLayout]);
  const activeItemIds = new Set(interactionContext?.relatedItemIds ?? []);
  const activeSegmentIds = new Set(interactionContext?.relatedSegmentIds ?? []);
  const activeConnectorIds = new Set(interactionContext?.relatedConnectorIds ?? []);
  const activeTurnBandId = interactionContext?.selectedTurnBand?.turnBandId ?? null;
  const hasInteractionFocus =
    activeItemIds.size > 0 || activeSegmentIds.size > 0 || activeConnectorIds.size > 0;
  const sessionTitle = selectedSession
    ? formatSessionDisplayTitle({
        rawTitle: selectedSession.title,
        workspacePath: selectedSession.workspace_path,
      })
    : deferredProjection
      ? formatSessionDisplayTitle({
          rawTitle: deferredProjection.session.title,
          workspacePath: deferredProjection.session.workspace_path,
        })
      : null;

  return (
    <GlassSurface
      refraction="none"
      variant="panel"
      className="flex h-full min-h-[520px] min-w-0 w-full flex-col overflow-hidden"
    >
      <Card className={PANEL_CARD_CLASS}>
        <div aria-hidden="true" className={PANEL_AMBIENCE_CLASS} />
        <CardHeader className="relative z-10 bg-transparent px-5 pb-2.5 pt-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.08em] text-emerald-300/92">
                  <Activity className="h-3.5 w-3.5" />
                  Sequence timeline
                </div>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-400">
                  <span
                    className="max-w-[34rem] truncate text-[13px] font-medium tracking-[-0.01em] text-slate-100"
                    title={sessionTitle?.tooltip}
                  >
                    {sessionTitle?.displayTitle ?? "No active session context"}
                  </span>
                  {sessionTitle ? (
                    <>
                      <span className="text-slate-600">/</span>
                      <span className="text-slate-400/82">{sessionTitle.workspaceLabel}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {selection.kind !== "session" ? (
                  <GlassSurface className="rounded-full" refraction="none" variant="control">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-[inherit] border-0 bg-transparent px-2.5 text-[10.5px] font-medium text-slate-100 hover:bg-transparent hover:text-white"
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
                      className="h-7 rounded-[inherit] border-0 bg-transparent px-2.5 text-[10.5px] font-medium text-slate-100 hover:bg-transparent hover:text-white"
                      onClick={handleRefollow}
                    >
                      {viewport?.followLatest ? (
                        <Eye className="h-3.5 w-3.5 text-emerald-200" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-amber-200" />
                      )}
                      {liveFollowLabel}
                    </Button>
                  </GlassSurface>
                ) : null}

                <GlassSurface className="rounded-full" refraction="none" variant="control">
                  <div
                    className="px-2.5 py-1.5 text-[10.5px] font-medium tracking-[0.01em] text-emerald-200"
                    data-testid="timeline-follow-state"
                  >
                    {latestCopy.badge}
                  </div>
                </GlassSurface>
                <GlassSurface className="rounded-full" refraction="none" variant="control">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono tracking-[0.1em] text-slate-100">
                    <Clock3 className="h-3.5 w-3.5 text-sky-300" />
                    {!stageMetrics.isNarrow && selectedSession
                      ? formatTimestamp(selectedSession.last_event_at)
                      : !stageMetrics.isNarrow
                        ? "Awaiting selection"
                        : "Latest"}
                  </div>
                </GlassSurface>
              </div>
            </div>

            {emptyState ? (
              <p className="text-[12px] leading-relaxed text-slate-300/66">{latestCopy.body}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-400">
              <span>{laneCount > 0 ? `${laneCount} lanes` : "No lanes"}</span>
              <span className="text-slate-500">/</span>
              <span>{selectionLabel(deferredProjection, selectionContext)}</span>
              <span className="text-slate-500">/</span>
              <span>{isLiveCompact ? "idle gaps folded" : currentDensity}</span>
              <span className="text-slate-500">/</span>
              <span>spawn · handoff · reply · complete</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 flex min-w-0 flex-1 overflow-hidden bg-transparent p-0">
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
            <div className="flex min-h-0 min-w-0 flex-1">
              <div
                ref={scrollRef}
                className="min-h-0 min-w-0 flex-1 overflow-auto no-scrollbar"
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
                    height: contentHeight + stageMetrics.headerHeight + 20,
                    minWidth: contentWidth,
                  }}
                >
                  <div
                    className="sticky top-0 z-20 grid border-b border-white/6 bg-[linear-gradient(180deg,rgba(8,12,22,0.94),rgba(8,12,22,0.78))] backdrop-blur-xl"
                    style={{
                      gridTemplateColumns: `${stageMetrics.axisWidth}px repeat(${Math.max(laneCount, 1)}, ${stageMetrics.laneWidth}px)`,
                      height: stageMetrics.headerHeight,
                    }}
                  >
                    <div
                      className={`flex flex-col justify-center ${
                        stageMetrics.isCompact ? "px-3 text-[9px]" : "px-4 text-[10px]"
                      } font-medium tracking-[0.08em] text-slate-500`}
                    >
                      {isLiveCompact ? "Flow" : "Time"}
                    </div>
                    {deferredProjection.lanes.map((lane) => {
                      const tone = COLUMN_TONES[lane.column];
                      return (
                        <div
                          key={lane.laneId}
                          className={`flex items-center border-l border-white/5 ${
                            stageMetrics.isCompact ? "px-2.5" : "px-4"
                          }`}
                        >
                          <div
                            className={`flex w-full items-center justify-between rounded-[1rem] border border-white/6 bg-white/[0.03] ${
                              stageMetrics.isCompact ? "px-2.5 py-1.5" : "px-3 py-2"
                            }`}
                          >
                            <div>
                              {!stageMetrics.isNarrow ? (
                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                                  {lane.column}
                                </p>
                              ) : null}
                              <p
                                className={`${stageMetrics.isNarrow ? "text-[10px]" : stageMetrics.isCompact ? "mt-1 text-[12px]" : "mt-1 text-sm"} text-white`}
                              >
                                {lane.label}
                              </p>
                            </div>
                            <span
                              className={`${stageMetrics.isCompact ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full`}
                              style={{ backgroundColor: tone.marker }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <svg
                    aria-hidden="true"
                    className="absolute left-0 top-0"
                    height={contentHeight + stageMetrics.headerHeight + 20}
                    width={contentWidth}
                  >
                    <defs>
                    {(["spawn", "handoff", "reply", "complete"] as const).map((kind) => {
                        const strokeColor =
                          kind === "spawn"
                            ? COLUMN_TONES.main.connector
                            : kind === "reply" || kind === "complete"
                              ? COLUMN_TONES.other.connector
                              : "rgba(226,232,240,0.74)";

                        return (
                          <marker
                            key={kind}
                            id={`timeline-arrow-${kind}`}
                            markerHeight="8"
                            markerWidth="8"
                            orient="auto"
                            refX="7"
                            refY="4"
                          >
                            <path d="M0,0 L8,4 L0,8 Z" fill={strokeColor} opacity="0.9" />
                          </marker>
                        );
                      })}
                    </defs>

                    {!isLiveCompact &&
                      ticks.map((tickMs) => {
                        const y =
                          stageMetrics.headerHeight +
                          timelineItemPosition(deferredProjection, tickMs, viewport.pixelsPerMs);
                        return (
                          <g key={tickMs}>
                            <line
                              stroke="rgba(148,163,184,0.14)"
                              strokeDasharray="4 8"
                              strokeWidth="1"
                              x1={stageMetrics.axisWidth - 8}
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

                    {isLiveCompact && liveLayout
                      ? deferredProjection.turnBands.map((turnBand) => {
                          const bounds = liveLayout.turnBoundsById[turnBand.turnBandId];
                          if (!bounds) {
                            return null;
                          }

                          const isActiveBand = activeTurnBandId === turnBand.turnBandId;
                          return (
                            <rect
                              key={turnBand.turnBandId}
                              fill={COLUMN_TONES.user.bandFill}
                              height={Math.max(bounds.height + 8, 46)}
                              opacity={hasInteractionFocus && !isActiveBand ? 0.34 : 1}
                              rx={20}
                              stroke={
                                isActiveBand
                                  ? COLUMN_TONES.user.bandStroke
                                  : "rgba(255,255,255,0.06)"
                              }
                              strokeWidth={isActiveBand ? 1.2 : 1}
                              width={contentWidth - stageMetrics.axisWidth - stageMetrics.turnInset * 2}
                              x={stageMetrics.axisWidth + stageMetrics.turnInset}
                              y={stageMetrics.headerHeight + bounds.top - 4}
                            />
                          );
                        })
                      : deferredProjection.turnBands.map((turnBand) => {
                          const top =
                            stageMetrics.headerHeight +
                            timelineItemPosition(
                              deferredProjection,
                              turnBand.startedAtMs,
                              viewport.pixelsPerMs,
                            ) -
                            10;
                          const height = Math.max(
                            timelineItemPosition(
                              deferredProjection,
                              turnBand.endedAtMs,
                              viewport.pixelsPerMs,
                            ) -
                              timelineItemPosition(
                                deferredProjection,
                                turnBand.startedAtMs,
                                viewport.pixelsPerMs,
                              ) +
                              24,
                            46,
                          );
                          const isActiveBand = activeTurnBandId === turnBand.turnBandId;

                          return (
                            <rect
                              key={turnBand.turnBandId}
                              fill={COLUMN_TONES.user.bandFill}
                              height={height}
                              opacity={hasInteractionFocus && !isActiveBand ? 0.34 : 1}
                              rx={20}
                              stroke={
                                isActiveBand
                                  ? COLUMN_TONES.user.bandStroke
                                  : "rgba(255,255,255,0.06)"
                              }
                              strokeWidth={isActiveBand ? 1.2 : 1}
                              width={contentWidth - stageMetrics.axisWidth - stageMetrics.turnInset * 2}
                              x={stageMetrics.axisWidth + stageMetrics.turnInset}
                              y={top}
                            />
                          );
                        })}

                    {deferredProjection.lanes.map((lane, index) => {
                      const center = laneCenter(index, stageMetrics);
                      const tone = COLUMN_TONES[lane.column];
                      return (
                        <g key={lane.laneId}>
                          <line
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1.1"
                            x1={center}
                            x2={center}
                            y1={stageMetrics.headerHeight}
                            y2={contentHeight + stageMetrics.headerHeight}
                          />
                          <rect
                            fill={tone.bandFill}
                            height={contentHeight - 28}
                            rx={24}
                            stroke="rgba(255,255,255,0.03)"
                            width={stageMetrics.laneWidth - stageMetrics.laneCardInset * 2}
                            x={center - (stageMetrics.laneWidth - stageMetrics.laneCardInset * 2) / 2}
                            y={stageMetrics.headerHeight + 16}
                          />
                        </g>
                        );
                      })}

                    {isLiveCompact &&
                      liveLayout?.gapFolds.map((gapFold) => {
                        const y = stageMetrics.headerHeight + gapFold.top + gapFold.height / 2;

                        return (
                          <g key={gapFold.gapId}>
                            <line
                              stroke="rgba(148,163,184,0.22)"
                              strokeDasharray="4 8"
                              strokeWidth="1"
                              x1={stageMetrics.axisWidth - 8}
                              x2={contentWidth - 24}
                              y1={y}
                              y2={y}
                            />
                            <text
                              fill="rgba(148,163,184,0.76)"
                              fontFamily="IBM Plex Mono, monospace"
                              fontSize="10"
                              x={18}
                              y={y - 6}
                            >
                              {gapFold.label}
                            </text>
                          </g>
                        );
                      })}

                    {deferredProjection.connectors.map((connector) => {
                      const pathMeta =
                        isLiveCompact && liveLayout
                          ? liveConnectorPath(connector, laneIndexById, liveLayout, stageMetrics)
                          : connectorPath(
                              connector,
                              laneIndexById,
                              deferredProjection,
                              viewport.pixelsPerMs,
                              stageMetrics,
                            );
                      const sourceLane =
                        deferredProjection.lanes.find((lane) => lane.laneId === connector.sourceLaneId) ??
                        deferredProjection.lanes[0];
                      const tone = connector.kind === "spawn"
                        ? COLUMN_TONES.main
                        : connector.kind === "reply" || connector.kind === "complete"
                          ? COLUMN_TONES.other
                          : COLUMN_TONES[sourceLane.column];
                      const stroke = connectorStroke(connector.kind);
                      const isSelected = selection.kind === "connector" && selection.connectorId === connector.connectorId;
                      const isActive = activeConnectorIds.has(connector.connectorId);
                      const isDimmed = hasInteractionFocus && !isActive;

                      return (
                        <g key={connector.connectorId}>
                          <path
                            d={pathMeta.path}
                            fill="none"
                            markerEnd={`url(#timeline-arrow-${connector.kind})`}
                            opacity={isDimmed ? 0.24 : isSelected || isActive ? 1 : 0.72}
                            stroke={tone.connector}
                            strokeDasharray={stroke.dashArray}
                            strokeWidth={isSelected || isActive ? stroke.strokeWidth + 0.4 : stroke.strokeWidth}
                          />
                          <path
                            aria-label={`${stroke.label} ${connector.sourceLaneId} to ${connector.targetLaneId}`}
                            className="cursor-pointer"
                            d={pathMeta.path}
                            data-testid={`timeline-connector-${connector.connectorId}`}
                            fill="none"
                            onClick={() =>
                              onSelectionChange({
                                anchorItemId: connector.anchorItemId,
                                connectorId: connector.connectorId,
                                kind: "connector",
                              })
                            }
                            onMouseEnter={() =>
                              setHoverSelection({
                                anchorItemId: connector.anchorItemId,
                                connectorId: connector.connectorId,
                                kind: "connector",
                              })
                            }
                            onMouseLeave={() => setHoverSelection(null)}
                            pointerEvents="stroke"
                            stroke="transparent"
                            strokeWidth="16"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {isLiveCompact && liveLayout
                    ? liveLayout.turnHeaders.map((header) => {
                        const turnBand = deferredProjection.turnBandsById[header.turnBandId];
                        const isActiveBand = activeTurnBandId === header.turnBandId;
                        const isDimmed = hasInteractionFocus && !isActiveBand;

                        return (
                          <div
                            key={header.headerId}
                            className="pointer-events-none absolute left-0 right-0 z-10"
                            data-testid={`timeline-turn-header-row-${header.turnBandId}`}
                            style={{
                              top: stageMetrics.headerHeight + header.top,
                            }}
                          >
                            <div
                              style={{
                                paddingLeft: stageMetrics.turnHeaderPaddingLeft,
                                paddingRight: stageMetrics.turnHeaderPaddingRight,
                              }}
                            >
                              {header.userItemId ? (
                                <button
                                  aria-label={header.summary ?? turnBand?.label ?? "Turn summary"}
                                  className={`pointer-events-auto flex ${
                                    stageMetrics.isNarrow
                                      ? "min-h-[2.4rem] max-w-full gap-2 px-2.5 py-2 text-[10px]"
                                      : "min-h-[2.75rem] max-w-[min(38rem,100%)] gap-3 px-3 py-2 text-[11px]"
                                  } items-center rounded-[1rem] border text-left font-medium tracking-[0.01em] text-amber-50 shadow-[0_10px_20px_rgba(8,12,22,0.24)] transition-opacity ${
                                    isActiveBand
                                      ? "border-amber-200/30 bg-amber-300/18"
                                      : "border-white/8 bg-[#0f1724]/82"
                                  }`}
                                  data-testid={`timeline-turn-header-${header.turnBandId}`}
                                  data-timeline-interactive=""
                                  onClick={() =>
                                    onSelectionChange({
                                      itemId: header.userItemId ?? header.turnBandId,
                                      kind: "item",
                                    })
                                  }
                                  onMouseEnter={() =>
                                    header.userItemId
                                      ? setHoverSelection({
                                          itemId: header.userItemId,
                                          kind: "item",
                                        })
                                      : undefined
                                  }
                                  onMouseLeave={() => setHoverSelection(null)}
                                  style={{
                                    opacity: isDimmed ? 0.38 : 1,
                                  }}
                                  type="button"
                                >
                                  <span className="text-[10px] uppercase tracking-[0.08em] text-amber-200/72">
                                    {turnBand?.label ?? "Turn"}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-slate-100/92">
                                    {header.summary}
                                  </span>
                                  {!stageMetrics.isNarrow ? (
                                    <span className="text-[10px] font-mono tracking-[0.08em] text-slate-400">
                                      {formatTimestamp(new Date(header.startedAtMs).toISOString())}
                                    </span>
                                  ) : null}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    : deferredProjection.turnBands.map((turnBand) => {
                        const top =
                          stageMetrics.headerHeight +
                          timelineItemPosition(
                            deferredProjection,
                            turnBand.startedAtMs,
                            viewport.pixelsPerMs,
                          );
                        const isActiveBand = activeTurnBandId === turnBand.turnBandId;
                        const isDimmed = hasInteractionFocus && !isActiveBand;

                        return (
                          <div
                            key={`${turnBand.turnBandId}:label`}
                            className="pointer-events-none absolute left-0 right-0 z-10"
                            style={{
                              top,
                            }}
                          >
                            <div
                              style={{
                                paddingLeft: stageMetrics.turnHeaderPaddingLeft,
                                paddingRight: stageMetrics.turnHeaderPaddingRight,
                              }}
                            >
                              {turnBand.userItemId ? (
                                <button
                                  aria-label={turnBand.summary ?? turnBand.label}
                                  className={`pointer-events-auto ${
                                    stageMetrics.isNarrow
                                      ? "max-w-full px-2.5 py-1.5 text-[10px]"
                                      : "max-w-[min(36rem,100%)] px-3 py-1.5 text-[11px]"
                                  } rounded-full border text-left font-medium tracking-[0.01em] text-amber-50 shadow-[0_8px_18px_rgba(8,12,22,0.24)] transition-opacity ${
                                    isActiveBand
                                      ? "border-amber-200/30 bg-amber-300/18"
                                      : "border-white/8 bg-[#0f1724]/78"
                                  }`}
                                  data-timeline-interactive=""
                                  onClick={() =>
                                    onSelectionChange({
                                      itemId: turnBand.userItemId ?? turnBand.turnBandId,
                                      kind: "item",
                                    })
                                  }
                                  onMouseEnter={() =>
                                    turnBand.userItemId
                                      ? setHoverSelection({
                                          itemId: turnBand.userItemId,
                                          kind: "item",
                                        })
                                      : undefined
                                  }
                                  onMouseLeave={() => setHoverSelection(null)}
                                  style={{
                                    opacity: isDimmed ? 0.38 : 1,
                                  }}
                                  type="button"
                                >
                                  <span className="mr-2 text-[10px] uppercase tracking-[0.08em] text-amber-200/74">
                                    {turnBand.label}
                                  </span>
                                  <span className="text-slate-100/90">{turnBand.summary}</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}

                  {deferredProjection.activationSegments.map((segment) => {
                    const laneIndex = laneIndexById[segment.laneId];
                    const lane = deferredProjection.lanes[laneIndex];
                    const tone = COLUMN_TONES[lane.column];
                    const liveBounds = isLiveCompact ? liveLayout?.segmentBoundsById[segment.segmentId] : null;
                    const top = liveBounds
                      ? stageMetrics.headerHeight + liveBounds.top
                      : stageMetrics.headerHeight +
                        timelineItemPosition(
                          deferredProjection,
                          segment.startedAtMs,
                          viewport.pixelsPerMs,
                        );
                    const bottom = liveBounds
                      ? stageMetrics.headerHeight + liveBounds.bottom
                      : stageMetrics.headerHeight +
                        timelineItemPosition(
                          deferredProjection,
                          segment.endedAtMs,
                          viewport.pixelsPerMs,
                        );
                    const height = liveBounds
                      ? liveBounds.height
                      : Math.max(bottom - top, currentDensity === "overview" ? 26 : 34);
                    const left =
                      laneCenter(laneIndex, stageMetrics) - stageMetrics.activationWidth / 2;
                    const isSelected =
                      selection.kind === "segment" && selection.segmentId === segment.segmentId;
                    const isActive = activeSegmentIds.has(segment.segmentId);
                    const isDimmed = hasInteractionFocus && !isActive;
                    const isFresh = freshLatest.segmentId === segment.segmentId;

                    return (
                      <button
                        key={segment.segmentId}
                        aria-label={`${lane.label} activation in ${segment.turnBandId}`}
                        className={`absolute z-10 rounded-full border transition-[box-shadow,opacity,transform] ${
                          isFresh ? "timeline-fresh-flash" : ""
                        } ${
                          isSelected
                            ? "shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_0_8px_rgba(56,189,248,0.12)]"
                            : ""
                        }`}
                        data-testid={`timeline-segment-${segment.segmentId}`}
                        data-timeline-interactive=""
                        onClick={() =>
                          onSelectionChange({
                            anchorItemId: segment.anchorItemId,
                            kind: "segment",
                            segmentId: segment.segmentId,
                          })
                        }
                        onMouseEnter={() =>
                          setHoverSelection({
                            anchorItemId: segment.anchorItemId,
                            kind: "segment",
                            segmentId: segment.segmentId,
                          })
                        }
                        onMouseLeave={() => setHoverSelection(null)}
                        style={{
                          backgroundColor: tone.activation,
                          borderColor: isSelected || isActive ? tone.activationBorder : "rgba(255,255,255,0.08)",
                          boxShadow: isSelected || isActive ? `0 0 0 1px ${tone.activationBorder}, 0 0 22px ${tone.glow}` : `0 0 0 1px rgba(255,255,255,0.06), 0 6px 16px ${tone.glow}`,
                          height,
                          left,
                          opacity: isDimmed ? 0.28 : 1,
                          top,
                          width: stageMetrics.activationWidth,
                        }}
                        type="button"
                      />
                    );
                  })}

                  {deferredProjection.items.map((item) => {
                    const laneIndex = laneIndexById[item.laneId];
                    const segmentId = deferredProjection.relationMap.items[item.itemId]?.segmentId ?? null;
                    const segment = segmentId ? deferredProjection.segmentsById[segmentId] ?? null : null;
                    const top = isLiveCompact
                      ? stageMetrics.headerHeight + (liveLayout?.itemYById[item.itemId] ?? 0)
                      : stageMetrics.headerHeight +
                        timelineItemPosition(
                          deferredProjection,
                          item.startedAtMs,
                          viewport.pixelsPerMs,
                        );
                    const isSelected = selection.kind === "item" && selection.itemId === item.itemId;
                    const isActive = activeItemIds.has(item.itemId);
                    const isDimmed = hasInteractionFocus && !isActive;
                    const isFresh = freshLatest.itemId === item.itemId;
                    const durationMs =
                      item.endedAtMs != null ? Math.max(item.endedAtMs - item.startedAtMs, 0) : null;

                    if (isPromptItem(item)) {
                      return null;
                    }

                    if (isLiveCompact) {
                      if (!liveRenderItemIds.has(item.itemId)) {
                        return null;
                      }

                      const tone = pointTone(item);
                      const showLabel = item.kind === "message" || item.kind === "error";
                      const width = showLabel ? (stageMetrics.isNarrow ? 96 : 192) : 52;
                      const pointSize = stageMetrics.isNarrow ? 14 : 18;
                      const terminalKind = segment?.terminalEventKind;

                      return (
                        <button
                          key={item.itemId}
                          aria-label={item.label}
                          className={`absolute z-20 flex items-center gap-2 text-left transition-opacity ${
                            isFresh ? "timeline-fresh-flash" : ""
                          }`}
                          data-kind={item.kind}
                          data-testid={`timeline-item-${item.itemId}`}
                          data-timeline-interactive=""
                          onClick={() => onSelectionChange({ itemId: item.itemId, kind: "item" })}
                          onMouseEnter={() => setHoverSelection({ itemId: item.itemId, kind: "item" })}
                          onMouseLeave={() => setHoverSelection(null)}
                          style={{
                            left: laneCenter(laneIndex, stageMetrics) - pointSize / 2,
                            opacity: isDimmed ? 0.24 : 1,
                            top: top - pointSize / 2,
                            width,
                          }}
                          type="button"
                        >
                          <span
                            className={`block rounded-full ${stageMetrics.isNarrow ? "ring-2" : "ring-4"} ${tone.dot} ${tone.ring}`}
                            style={{
                              height: pointSize,
                              boxShadow:
                                isSelected || isActive
                                  ? "0 0 0 1px rgba(255,255,255,0.18), 0 0 18px rgba(125,211,252,0.16)"
                                  : undefined,
                              width: pointSize,
                            }}
                          />
                          {showLabel ? (
                            <span className={`min-w-0 truncate text-[11px] ${tone.text}`}>
                              {item.summary ?? item.label}
                            </span>
                          ) : terminalKind === "spawn" || terminalKind === "agent_complete" ? (
                            <span className={`text-[10px] font-medium uppercase tracking-[0.08em] ${tone.text}`}>
                              {terminalKind === "spawn" ? "Spawn" : "Done"}
                            </span>
                          ) : null}
                        </button>
                      );
                    }

                    if (isCapsuleItem(item)) {
                      if (isLinkedSpawnToolItem(item)) {
                        return null;
                      }

                      if (currentDensity === "overview") {
                        return null;
                      }

                      const tone = capsuleTone(item);
                      const width = currentDensity === "close" ? 170 : 152;
                      const height = Math.max(
                        timelineSpanHeight(durationMs, viewport.pixelsPerMs),
                        currentDensity === "close" ? 64 : 38,
                      );

                      return (
                        <button
                          key={item.itemId}
                          aria-label={item.label}
                          className={`absolute z-20 overflow-hidden rounded-[1.05rem] border px-3 py-2 text-left transition-[opacity,transform,box-shadow] ${
                            tone.border
                          } ${tone.body} ${tone.glow} ${isFresh ? "timeline-fresh-flash" : ""}`}
                          data-kind={item.kind}
                          data-testid={`timeline-item-${item.itemId}`}
                          data-timeline-interactive=""
                          onClick={() => onSelectionChange({ itemId: item.itemId, kind: "item" })}
                          onMouseEnter={() => setHoverSelection({ itemId: item.itemId, kind: "item" })}
                          onMouseLeave={() => setHoverSelection(null)}
                          style={{
                            boxShadow: isSelected || isActive
                              ? "0 0 0 1px rgba(191,219,254,0.24), 0 0 0 6px rgba(56,189,248,0.12), 0 14px 28px rgba(2,6,23,0.3)"
                              : undefined,
                            height,
                            left: laneCenter(laneIndex, stageMetrics) - width / 2,
                            opacity: isDimmed ? 0.22 : 1,
                            top,
                            width,
                          }}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-[10px] font-medium uppercase tracking-[0.08em] ${tone.text}`}>
                                {tone.badge}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-slate-100">{item.label}</p>
                            </div>
                            {(item.tokenInput > 0 || item.tokenOutput > 0) && (
                              <span className="rounded-full border border-white/8 bg-white/[0.055] px-2 py-1 text-[9px] font-mono text-slate-200">
                                {item.tokenInput + item.tokenOutput} tok
                              </span>
                            )}
                          </div>
                          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-200/84">
                            {item.summary ?? item.payloadPreview ?? "No summary available"}
                          </p>
                          {currentDensity === "close" ? (
                            <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-400">
                              {item.outputPreview ?? item.inputPreview ?? item.payloadPreview ?? "No preview available"}
                            </p>
                          ) : null}
                        </button>
                      );
                    }

                    if (currentDensity === "overview" && !isOverviewVisiblePoint(item, segment)) {
                      return null;
                    }

                    const tone = pointTone(item);
                    const showLabel = currentDensity === "close";
                    const width = showLabel ? 168 : 18;
                    const pointSize = 18;
                    const left = laneCenter(laneIndex, stageMetrics) - pointSize / 2;
                    const terminalKind = segment?.terminalEventKind;

                    return (
                      <button
                        key={item.itemId}
                        aria-label={item.label}
                        className={`absolute z-20 flex items-center gap-2 text-left transition-opacity ${
                          isFresh ? "timeline-fresh-flash" : ""
                        }`}
                        data-kind={item.kind}
                        data-testid={`timeline-item-${item.itemId}`}
                        data-timeline-interactive=""
                        onClick={() => onSelectionChange({ itemId: item.itemId, kind: "item" })}
                        onMouseEnter={() => setHoverSelection({ itemId: item.itemId, kind: "item" })}
                        onMouseLeave={() => setHoverSelection(null)}
                        style={{
                          left,
                          opacity: isDimmed ? 0.24 : 1,
                          top: top - 6,
                          width,
                        }}
                        type="button"
                      >
                        <span
                          className={`block h-[18px] w-[18px] rounded-full ring-4 ${tone.dot} ${tone.ring}`}
                          style={{
                            boxShadow:
                              isSelected || isActive
                                ? "0 0 0 1px rgba(255,255,255,0.18), 0 0 18px rgba(125,211,252,0.16)"
                                : undefined,
                          }}
                        />
                        {showLabel ? (
                          <span className={`min-w-0 truncate text-[11px] ${tone.text}`}>
                            {item.summary ?? item.label}
                          </span>
                        ) : terminalKind === "spawn" || terminalKind === "agent_complete" ? (
                          <span className={`text-[10px] font-medium uppercase tracking-[0.08em] ${tone.text}`}>
                            {terminalKind === "spawn" ? "Spawn" : "Done"}
                          </span>
                        ) : null}
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
