import { Activity, Clock3, GitBranch, MessageSquare, Wrench } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import type {
  ThreadTimelineLane,
  ThreadTimelineMarker,
  ThreadTimelineViewModel,
} from "@/features/thread-detail/lib/build-thread-timeline-view-model";

const LANE_HEIGHT = 68;
const LANE_GAP = 12;

type ThreadSwimlanePanelProps = {
  viewModel: ThreadTimelineViewModel;
  activeMarker: ThreadTimelineMarker | null;
  selectedMarkerId: string | null;
  onMarkerHover: (markerId: string | null) => void;
  onMarkerSelect: (markerId: string) => void;
};

const blockClassMap = {
  wait: "border-[hsl(var(--warn)/0.45)] bg-[hsl(var(--warn)/0.16)] text-[hsl(var(--warn))]",
  tool: "border-[hsl(var(--line-strong)/0.55)] bg-[hsl(var(--accent)/0.55)] text-[hsl(var(--fg))]",
} as const;

const markerClassMap = {
  commentary:
    "border-[hsl(var(--line-strong))] bg-[hsl(var(--panel))] text-[hsl(var(--fg))]",
  spawn: "border-emerald-400/60 bg-emerald-500/18 text-emerald-200",
  final: "border-rose-400/60 bg-rose-500/18 text-rose-200",
} as const;

export function ThreadSwimlanePanel({
  viewModel,
  activeMarker,
  selectedMarkerId,
  onMarkerHover,
  onMarkerSelect,
}: ThreadSwimlanePanelProps) {
  const timelineHeight =
    viewModel.lanes.length * LANE_HEIGHT +
    Math.max(viewModel.lanes.length - 1, 0) * LANE_GAP;
  const laneIndexById = new Map(
    viewModel.lanes.map((lane, index) => [lane.id, index]),
  );
  const laneById = new Map(viewModel.lanes.map((lane) => [lane.id, lane]));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity size={16} />
              Thread swimlane timeline
            </div>
            <p className="text-xs text-[hsl(var(--muted))]">
              main thread와 subagent session window를 같은 시간축에 정렬합니다.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
            <Clock3 size={13} />
            {formatClock(viewModel.window.started_at)} -{" "}
            {formatClock(viewModel.window.ended_at)}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-[hsl(var(--muted))]">
          <LegendPill icon={<Clock3 size={12} />} label="wait" />
          <LegendPill icon={<Wrench size={12} />} label="tool" />
          <LegendPill icon={<MessageSquare size={12} />} label="marker" />
          <LegendPill icon={<GitBranch size={12} />} label="wait linkage" />
        </div>

        <div className="grid grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)] gap-3">
          <div />
          <div className="flex items-center justify-between px-1 text-[11px] text-[hsl(var(--muted))]">
            <span>{formatClock(viewModel.window.started_at)}</span>
            <span>{formatClock(viewModel.window.ended_at)}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)] gap-3">
          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            {viewModel.lanes.map((lane, index) => (
              <LaneLabel
                key={lane.id}
                lane={lane}
                top={index * (LANE_HEIGHT + LANE_GAP)}
              />
            ))}
          </div>

          <div
            aria-label="Thread swimlane timeline"
            data-testid="thread-swimlane-panel"
            className="relative overflow-hidden rounded-2xl border border-[hsl(var(--line))] bg-[linear-gradient(90deg,hsl(var(--panel)/0.88),hsl(var(--panel-2)/0.96))]"
            style={{ height: `${timelineHeight}px` }}
          >
            <TimelineGrid />
            <svg
              className="pointer-events-none absolute inset-0 z-10 h-full w-full"
              data-testid="wait-connector-layer"
              viewBox={`0 0 100 ${timelineHeight}`}
              preserveAspectRatio="none"
            >
              {viewModel.connectors.map((connector) => {
                const parentIndex = laneIndexById.get(connector.parent_lane_id);
                const childIndex = laneIndexById.get(connector.child_lane_id);
                if (parentIndex === undefined || childIndex === undefined) {
                  return null;
                }

                return (
                  <line
                    key={connector.id}
                    data-testid={connector.id}
                    x1={connector.source_left_pct}
                    x2={connector.target_left_pct}
                    y1={computeLaneCenter(parentIndex)}
                    y2={computeLaneCenter(childIndex)}
                    stroke="hsla(192, 83%, 46%, 0.75)"
                    strokeDasharray="3 3"
                    strokeWidth="0.6"
                  />
                );
              })}
            </svg>

            {viewModel.lanes.map((lane, index) => (
              <div
                key={lane.id}
                data-testid={`lane-${lane.id}`}
                className="absolute inset-x-0 z-20"
                style={{
                  top: `${index * (LANE_HEIGHT + LANE_GAP)}px`,
                  height: `${LANE_HEIGHT}px`,
                }}
              >
                <div className="absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-xl border border-[hsl(var(--line)/0.7)] bg-[hsl(var(--panel)/0.72)]" />

                {lane.session_bar ? (
                  <span
                    data-testid={`session-${lane.id}`}
                    className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-[hsl(var(--ok))] shadow-[0_0_0_1px_rgba(15,23,42,0.24)]"
                    style={toInlineGeometry(lane.session_bar.geometry)}
                  />
                ) : null}

                {lane.blocks.map((block) => (
                  <span
                    key={block.id}
                    data-testid={block.id}
                    className={cn(
                      "absolute top-1/2 flex h-6 -translate-y-1/2 items-center rounded-full border px-2 text-[11px] font-medium shadow-[0_0_0_1px_rgba(15,23,42,0.18)]",
                      blockClassMap[block.kind],
                    )}
                    style={toInlineGeometry(block.geometry)}
                    title={`${block.label} ${renderDuration(block.duration_ms)}`}
                  >
                    {block.kind === "wait" ? (
                      <Clock3 size={11} className="mr-1 shrink-0" />
                    ) : (
                      <Wrench size={11} className="mr-1 shrink-0" />
                    )}
                    <span className="truncate">{block.label}</span>
                  </span>
                ))}

                {lane.markers.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    aria-label={buildMarkerLabel(marker)}
                    aria-pressed={selectedMarkerId === marker.id}
                    data-testid={`marker-${marker.id}`}
                    className={cn(
                      "absolute top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] shadow-[0_0_0_1px_rgba(15,23,42,0.24)] transition-transform hover:-translate-y-0.5",
                      markerClassMap[marker.kind],
                      selectedMarkerId === marker.id
                        ? "ring-2 ring-[hsl(var(--fg))] ring-offset-2 ring-offset-[hsl(var(--panel-2))]"
                        : "",
                    )}
                    style={{
                      left: `calc(${marker.position_pct}% - 0.625rem)`,
                    }}
                    onMouseEnter={() => onMarkerHover(marker.id)}
                    onMouseLeave={() => onMarkerHover(null)}
                    onFocus={() => onMarkerHover(marker.id)}
                    onBlur={() => onMarkerHover(null)}
                    onClick={() => onMarkerSelect(marker.id)}
                  >
                    <MarkerGlyph kind={marker.kind} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside
        data-testid="marker-summary-panel"
        className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Marker Summary
        </p>
        {activeMarker ? (
          <MarkerSummary
            lane={laneById.get(activeMarker.lane_id) ?? null}
            marker={activeMarker}
          />
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.68)] p-4 text-sm text-[hsl(var(--muted))]">
            commentary/spawn/final marker가 아직 없습니다.
          </div>
        )}
      </aside>
    </div>
  );
}

function TimelineGrid() {
  return (
    <>
      <div className="absolute inset-0 grid grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: grid line order is fixed
            key={index}
            className="border-r border-[hsl(var(--line)/0.35)] last:border-r-0"
          />
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 right-0 bg-[linear-gradient(180deg,transparent,hsla(220,22%,25%,0.06),transparent)]" />
    </>
  );
}

function LaneLabel({ lane, top }: { lane: ThreadTimelineLane; top: number }) {
  return (
    <div
      className="absolute inset-x-0 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.74)] p-3"
      style={{
        top: `${top}px`,
        height: `${LANE_HEIGHT}px`,
      }}
    >
      <p className="truncate text-sm font-medium">{lane.label}</p>
      <p className="mt-1 truncate text-xs text-[hsl(var(--muted))]">
        {lane.caption}
      </p>
    </div>
  );
}

function MarkerSummary({
  lane,
  marker,
}: {
  lane: ThreadTimelineLane | null;
  marker: ThreadTimelineMarker;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">
            {renderMarkerKind(marker.kind)}
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted))]">
            {lane?.label ?? "main thread"} • {formatTimestamp(marker.started_at)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            markerClassMap[marker.kind],
          )}
        >
          {marker.kind}
        </span>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.7)] p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Summary
        </p>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--fg))]">
          {marker.summary ?? "요약 텍스트가 없어 timestamp만 표시합니다."}
        </p>
      </div>

      <p className="text-xs text-[hsl(var(--muted))]">
        hover로 미리보기, click으로 선택 고정을 유지합니다.
      </p>
    </div>
  );
}

function LegendPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--line))] px-3 py-1">
      {icon}
      {label}
    </span>
  );
}

function MarkerGlyph({ kind }: { kind: ThreadTimelineMarker["kind"] }) {
  if (kind === "spawn") {
    return <GitBranch size={11} />;
  }

  if (kind === "final") {
    return <MessageSquare size={11} />;
  }

  return <span className="font-semibold">C</span>;
}

function toInlineGeometry(geometry: {
  left_pct: number;
  width_pct: number;
}) {
  return {
    left: `${geometry.left_pct}%`,
    width: `${geometry.width_pct}%`,
  };
}

function computeLaneCenter(index: number) {
  return index * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT / 2;
}

function renderMarkerKind(kind: ThreadTimelineMarker["kind"]) {
  if (kind === "spawn") {
    return "Spawn marker";
  }

  if (kind === "final") {
    return "Final marker";
  }

  return "Commentary marker";
}

function renderDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "in progress";
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds % 60}s`;
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildMarkerLabel(marker: ThreadTimelineMarker) {
  return `${marker.kind} marker ${marker.summary ?? formatClock(marker.started_at)}`;
}
