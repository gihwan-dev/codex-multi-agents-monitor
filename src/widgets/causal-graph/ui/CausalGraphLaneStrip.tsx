import type { RefObject } from "react";
import type { GraphSceneModel } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";

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

interface CausalGraphLaneStripProps {
  gridTemplateColumns: string;
  laneStripRef: RefObject<HTMLDivElement | null>;
  layout: GraphLayoutSnapshot;
  scene: GraphSceneModel;
}

export function CausalGraphLaneStrip({
  gridTemplateColumns,
  laneStripRef,
  layout,
  scene,
}: CausalGraphLaneStripProps) {
  return (
    <div
      ref={laneStripRef}
      data-slot="graph-lane-strip"
      className="sticky top-0 z-[4] grid items-center border-b border-[color:var(--color-chrome-border)]"
      style={{
        background: "var(--gradient-graph-sticky)",
        gridTemplateColumns,
        width: layout.contentWidth,
      }}
    >
      <div
        data-slot="graph-time-header"
        className="sticky left-0 z-[3] px-3 py-2 text-[0.76rem] uppercase tracking-[0.06em] text-muted-foreground"
        style={{ background: "var(--gradient-graph-time)" }}
      >
        Time (dur)
      </div>
      {scene.lanes.map((lane) => (
        <header
          key={lane.laneId}
          data-slot="graph-lane-header"
          data-lane-id={lane.laneId}
          className="relative flex min-h-12 items-center overflow-hidden border-l border-[color:var(--color-chrome-border-subtle)] px-3.5 py-2"
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
              <span className="rounded bg-[color:var(--color-graph-lane-role-bg)] px-1.5 py-0.5 text-[0.68rem] font-medium text-[var(--color-text-muted)]">
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
  );
}
