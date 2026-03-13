import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  UIEvent as ReactUIEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type {
  TimelineEdgeView,
  TimelineEventRowView,
  TimelineLiveDagView,
  TimelineTurnHeaderRowView,
} from "../../model/live-dag";
import type {
  TimelineSelection,
  TimelineSelectionContext,
  TimelineViewportState,
} from "../../model/types";
import { buildLiveDagStageLayout } from "./layout";

interface LiveDagStageProps {
  dag: TimelineLiveDagView;
  freshLatest: { itemId: string | null; segmentId: string | null };
  interactionContext: TimelineSelectionContext | null;
  onHoverSelectionChange: (selection: TimelineSelection | null) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  onSelectionChange: (selection: TimelineSelection) => void;
  onWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  selection: TimelineSelection;
  viewport: TimelineViewportState;
  viewportWidth: number;
}

function edgeTone(edge: TimelineEdgeView) {
  switch (edge.kind) {
    case "spawn":
      return {
        dashArray: undefined,
        markerId: "timeline-live-dag-arrow-spawn",
        stroke: "rgba(125, 211, 252, 0.92)",
        strokeWidth: 2.8,
      };
    case "tool":
      return {
        dashArray: "3 7",
        markerId: undefined,
        stroke: "rgba(148, 163, 184, 0.72)",
        strokeWidth: 1.3,
      };
    case "reply":
      return {
        dashArray: "4 8",
        markerId: "timeline-live-dag-arrow-flow",
        stroke: "rgba(226, 232, 240, 0.8)",
        strokeWidth: 1.45,
      };
    case "complete":
      return {
        dashArray: "5 8",
        markerId: "timeline-live-dag-arrow-flow",
        stroke: "rgba(248, 250, 252, 0.68)",
        strokeWidth: 1.45,
      };
    default:
      return {
        dashArray: undefined,
        markerId: "timeline-live-dag-arrow-flow",
        stroke: "rgba(226, 232, 240, 0.78)",
        strokeWidth: 1.5,
      };
  }
}

function edgePath(
  edge: TimelineEdgeView,
  rowLayoutById: ReturnType<typeof buildLiveDagStageLayout>["rowLayoutById"],
  trackCenterById: ReturnType<typeof buildLiveDagStageLayout>["trackCenterById"],
  annotationLeft: number,
) {
  const sourceRow = rowLayoutById[edge.source.rowId];
  const targetRow = rowLayoutById[edge.target.rowId];
  const sourceX =
    edge.source.trackId != null ? trackCenterById[edge.source.trackId] ?? annotationLeft : annotationLeft;
  const sourceY = sourceRow?.centerY ?? 0;

  if (edge.target.kind === "annotation") {
    const targetX = annotationLeft + 20;
    const targetY = targetRow?.centerY ?? sourceY;
    return `M ${sourceX} ${sourceY} C ${sourceX + 36} ${sourceY}, ${targetX - 28} ${targetY}, ${targetX} ${targetY}`;
  }

  const targetX = trackCenterById[edge.target.trackId] ?? sourceX;
  const targetY = targetRow?.centerY ?? sourceY;
  const controlX = sourceX + (targetX - sourceX) * 0.48;

  return `M ${sourceX} ${sourceY} C ${controlX} ${sourceY}, ${controlX} ${targetY}, ${targetX} ${targetY}`;
}

function rowTimeLabel(row: TimelineTurnHeaderRowView | TimelineEventRowView) {
  return row.kind === "turn-header" ? new Date(row.startedAtMs).toISOString() : row.annotation.timeLabel;
}

function formatLatency(latencyMs: number | null) {
  if (latencyMs == null) {
    return "n/a";
  }

  if (latencyMs >= 1_000) {
    return `${(latencyMs / 1_000).toFixed(1)}s`;
  }

  return `${latencyMs}ms`;
}

function formatPayloadSize(payloadSize: number | null) {
  if (payloadSize == null) {
    return "n/a";
  }

  if (payloadSize >= 1_024) {
    return `${(payloadSize / 1_024).toFixed(1)} KB`;
  }

  return `${payloadSize} B`;
}

function AnnotationMeta({
  payloadSize,
  tokens,
  toolLabel,
  latencyMs,
}: {
  latencyMs: number | null;
  payloadSize: number | null;
  tokens: number;
  toolLabel: string | null;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
      <span>{toolLabel ?? "event"}</span>
      <span>{tokens > 0 ? `${tokens} tok` : "0 tok"}</span>
      <span>{formatLatency(latencyMs)}</span>
      <span>{formatPayloadSize(payloadSize)}</span>
    </div>
  );
}

export function LiveDagStage({
  dag,
  freshLatest,
  interactionContext,
  onHoverSelectionChange,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onScroll,
  onSelectionChange,
  onWheel,
  scrollRef,
  selection,
  viewport,
  viewportWidth,
}: LiveDagStageProps) {
  const layout = useMemo(
    () => buildLiveDagStageLayout(dag, viewportWidth),
    [dag, viewportWidth],
  );
  const activeItemIds = new Set(interactionContext?.relatedItemIds ?? []);
  const activeConnectorIds = new Set(interactionContext?.relatedConnectorIds ?? []);
  const activeTurnBandId = interactionContext?.selectedTurnBand?.turnBandId ?? null;
  const hasInteractionFocus = activeItemIds.size > 0 || activeConnectorIds.size > 0;
  const annotationLeft = layout.metrics.gutterWidth + layout.metrics.graphWidth;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div
        ref={scrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-auto no-scrollbar"
        data-follow-latest={viewport.followLatest ? "true" : "false"}
        data-testid="timeline-scroll-area"
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onScroll={onScroll}
        onWheel={onWheel}
      >
        <div
          className="relative"
          data-testid="live-dag-stage"
          style={{
            height: layout.contentHeight + layout.metrics.headerHeight + 12,
            minWidth: layout.metrics.totalWidth,
          }}
        >
          <div
            className="sticky top-0 z-20 grid border-b border-white/8 bg-[linear-gradient(180deg,rgba(8,12,22,0.96),rgba(8,12,22,0.82))] backdrop-blur-xl"
            style={{
              gridTemplateColumns: `${layout.metrics.gutterWidth}px ${layout.metrics.graphWidth}px ${layout.metrics.annotationWidth}px`,
              height: layout.metrics.headerHeight,
            }}
          >
            <div className="flex flex-col justify-center border-r border-white/6 px-3 text-[10px] font-medium tracking-[0.08em] text-slate-500">
              <span>Turn / Time</span>
            </div>
            <div className="grid border-r border-white/6" style={{
              gridTemplateColumns: `repeat(${Math.max(dag.tracks.length, 1)}, minmax(${layout.metrics.trackWidth}px, 1fr))`,
            }}>
              {dag.tracks.map((track) => (
                <div
                  key={track.trackId}
                  className="flex items-center justify-center border-l border-white/5 px-2 text-[11px] font-medium text-slate-100 first:border-l-0"
                >
                  <span className="truncate">{track.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 text-[10px] font-medium tracking-[0.08em] text-slate-500">
              <span>Annotation</span>
              <span>{dag.rows.length} rows</span>
            </div>
          </div>

          <svg
            aria-hidden="true"
            className="absolute left-0 top-0"
            height={layout.contentHeight + layout.metrics.headerHeight + 12}
            width={layout.metrics.totalWidth}
          >
            <defs>
              <marker
                id="timeline-live-dag-arrow-flow"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="rgba(226,232,240,0.82)" />
              </marker>
              <marker
                id="timeline-live-dag-arrow-spawn"
                markerHeight="10"
                markerWidth="10"
                orient="auto"
                refX="8"
                refY="5"
              >
                <path d="M0,0 L10,5 L0,10 Z" fill="rgba(125,211,252,0.9)" />
              </marker>
            </defs>

            {dag.tracks.map((track) => {
              const centerX = layout.trackCenterById[track.trackId];
              return (
                <line
                  key={track.trackId}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1.1"
                  x1={centerX}
                  x2={centerX}
                  y1={layout.metrics.headerHeight + 8}
                  y2={layout.metrics.headerHeight + layout.contentHeight - 8}
                />
              );
            })}

            {dag.edges.map((edge) => {
              const tone = edgeTone(edge);
              const path = edgePath(
                edge,
                layout.rowLayoutById,
                layout.trackCenterById,
                annotationLeft,
              );
              const isSelected =
                selection.kind === "connector" && selection.connectorId === edge.connectorId;
              const isActive = edge.connectorId ? activeConnectorIds.has(edge.connectorId) : false;
              const isDimmed = hasInteractionFocus && !isActive && !isSelected;

              return (
                <g key={edge.edgeId}>
                  <path
                    d={path}
                    fill="none"
                    markerEnd={tone.markerId ? `url(#${tone.markerId})` : undefined}
                    opacity={isDimmed ? 0.18 : isSelected || isActive ? 1 : 0.7}
                    stroke={tone.stroke}
                    strokeDasharray={tone.dashArray}
                    strokeWidth={isSelected || isActive ? tone.strokeWidth + 0.4 : tone.strokeWidth}
                  />
                  {edge.connectorId ? (
                    <path
                      aria-label={edge.directionLabel ?? edge.edgeId}
                      className="cursor-pointer"
                      d={path}
                      data-testid={`timeline-connector-${edge.connectorId}`}
                      fill="none"
                      onClick={() => edge.selection && onSelectionChange(edge.selection)}
                      onMouseEnter={() => edge.selection && onHoverSelectionChange(edge.selection)}
                      onMouseLeave={() => onHoverSelectionChange(null)}
                      pointerEvents="stroke"
                      stroke="transparent"
                      strokeWidth="14"
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>

          {dag.rows.map((row) => {
            const rowLayout = layout.rowLayoutById[row.rowId];
            if (!rowLayout) {
              return null;
            }

            if (row.kind === "gap") {
              return (
                <div
                  key={row.rowId}
                  className="absolute left-0 right-0 z-10 px-3"
                  style={{ top: layout.metrics.headerHeight + rowLayout.top }}
                >
                  <div
                    className="flex h-full items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[11px] font-medium tracking-[0.06em] text-slate-300"
                    style={{ height: rowLayout.height }}
                  >
                    {row.label}
                  </div>
                </div>
              );
            }

            if (row.kind === "turn-header") {
              const isActive = activeTurnBandId === row.turnBandId;
              return (
                <div
                  key={row.rowId}
                  className="absolute left-0 right-0 z-10 grid items-center gap-0 px-0"
                  data-testid={`timeline-turn-header-row-${row.turnBandId}`}
                  style={{
                    gridTemplateColumns: `${layout.metrics.gutterWidth}px ${layout.metrics.graphWidth}px ${layout.metrics.annotationWidth}px`,
                    top: layout.metrics.headerHeight + rowLayout.top,
                  }}
                >
                  <div className="px-3 text-[10px] text-slate-500">
                    <div className="font-medium uppercase tracking-[0.08em] text-amber-200/74">{row.label}</div>
                    <div className="mt-1 font-mono text-slate-400">{rowTimeLabel(row)}</div>
                  </div>
                  <div className="relative h-full">
                    <div className="absolute inset-y-1 left-3 right-3 rounded-full border border-amber-300/12 bg-amber-300/[0.06]" />
                  </div>
                  <div className="px-3">
                    <button
                      aria-label={row.summary ?? row.label}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-[1rem] border px-3 py-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.24)] transition-colors",
                        isActive
                          ? "border-amber-200/32 bg-amber-300/16"
                          : "border-white/8 bg-[#0f1724]/86 hover:border-amber-200/20 hover:bg-[#121a2a]/92",
                      )}
                      data-testid={`timeline-turn-header-${row.turnBandId}`}
                      data-timeline-interactive=""
                      onClick={() => onSelectionChange(row.selection)}
                      onMouseEnter={() => onHoverSelectionChange(row.selection)}
                      onMouseLeave={() => onHoverSelectionChange(null)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-100">
                        {row.summary ?? row.label}
                      </span>
                      <span className="rounded-full border border-amber-200/18 bg-amber-200/10 px-2 py-1 text-[10px] font-medium text-amber-100">
                        prompt
                      </span>
                    </button>
                  </div>
                </div>
              );
            }

            const centerX = row.trackId ? layout.trackCenterById[row.trackId] : null;
            const isSelected = selection.kind === "item" && selection.itemId === row.itemId;
            const isActive = activeItemIds.has(row.itemId);
            const isDimmed = hasInteractionFocus && !isSelected && !isActive;
            const isFresh = freshLatest.itemId === row.itemId;
            const nodeClass =
              row.itemKind === "error"
                ? "bg-rose-300 ring-rose-200/24"
                : row.itemKind === "tool"
                  ? "bg-sky-300 ring-sky-200/24"
                  : row.itemKind === "reasoning"
                    ? "bg-emerald-300 ring-emerald-200/24"
                    : "bg-slate-200 ring-white/16";

            return (
              <div
                key={row.rowId}
                className="absolute left-0 right-0 grid items-center gap-0"
                data-testid={`timeline-event-row-${row.itemId}`}
                style={{
                  gridTemplateColumns: `${layout.metrics.gutterWidth}px ${layout.metrics.graphWidth}px ${layout.metrics.annotationWidth}px`,
                  top: layout.metrics.headerHeight + rowLayout.top,
                }}
              >
                <div className={cn("px-3", isDimmed ? "opacity-35" : "opacity-100")}>
                  <div className="text-[10px] font-mono text-slate-500">{row.annotation.timeLabel}</div>
                  <div className="mt-1 text-[11px] font-medium text-slate-300">{row.actorLabel}</div>
                </div>

                <div className="relative h-full">
                  <div className="absolute inset-y-0 left-0 right-0 border-b border-white/[0.045]" />
                  {centerX != null ? (
                    <span
                      className={cn(
                        "absolute rounded-full ring-4 transition-shadow",
                        nodeClass,
                        isFresh ? "timeline-fresh-flash" : "",
                      )}
                      style={{
                        height: layout.metrics.isNarrow ? 12 : 14,
                        left: centerX - (layout.metrics.isNarrow ? 6 : 7),
                        opacity: isDimmed ? 0.3 : 1,
                        top: rowLayout.height / 2 - (layout.metrics.isNarrow ? 6 : 7),
                        width: layout.metrics.isNarrow ? 12 : 14,
                      }}
                    />
                  ) : null}
                </div>

                <div className="px-3">
                  <button
                    aria-label={row.summary ?? row.itemId}
                    className={cn(
                      "w-full rounded-[1rem] border px-3 py-3 text-left transition-colors",
                      isSelected || isActive
                        ? "border-sky-200/24 bg-sky-300/[0.08]"
                        : "border-white/8 bg-[#0f1724]/84 hover:border-white/14 hover:bg-[#111827]/92",
                      isDimmed ? "opacity-35" : "opacity-100",
                      isFresh ? "timeline-fresh-flash" : "",
                    )}
                    data-testid={`timeline-item-${row.itemId}`}
                    data-timeline-interactive=""
                    onClick={() => onSelectionChange(row.selection)}
                    onMouseEnter={() => onHoverSelectionChange(row.selection)}
                    onMouseLeave={() => onHoverSelectionChange(null)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                            {row.itemKind}
                          </span>
                          {row.annotation.directionLabel ? (
                            <span className="truncate text-[10px] font-medium text-sky-200/88">
                              {row.annotation.directionLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-[12px] font-medium text-slate-100">
                          {row.summary ?? row.itemId}
                        </p>
                        {(row.requestPreview ?? row.responsePreview) ? (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-300/84">
                            {row.requestPreview ?? row.responsePreview}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[9px] font-medium text-slate-300">
                        {row.annotation.toolLabel ?? row.actorLabel}
                      </span>
                    </div>
                    <AnnotationMeta
                      latencyMs={row.annotation.latencyMs}
                      payloadSize={row.annotation.payloadSize}
                      tokens={row.annotation.tokenTotal}
                      toolLabel={row.annotation.toolLabel}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
