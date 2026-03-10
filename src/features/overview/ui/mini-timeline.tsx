import { cn } from "@/shared/lib/utils";
import type { MiniTimelineItem } from "@/shared/types/contracts";

type MiniTimelineProps = {
  items: MiniTimelineItem[];
  timelineId: string;
  windowStartedAt: string;
  windowEndedAt: string;
};

const timelineSegmentClassMap: Record<MiniTimelineItem["kind"], string> = {
  wait: "bg-amber-400/85",
  tool: "bg-cyan-400/80",
  message: "bg-slate-200/80",
  spawn: "bg-emerald-400/85",
  complete: "bg-rose-300/85",
};

export function MiniTimeline({
  items,
  timelineId,
  windowStartedAt,
  windowEndedAt,
}: MiniTimelineProps) {
  const windowStart = new Date(windowStartedAt).getTime();
  const windowEnd = new Date(windowEndedAt).getTime();
  const windowDuration = Math.max(windowEnd - windowStart, 1);

  return (
    <div
      aria-label="Mini timeline"
      role="img"
      data-testid={timelineId}
      className="relative h-10 rounded-xl border border-[hsl(var(--line))] bg-[linear-gradient(90deg,hsl(var(--panel)/0.86),hsl(var(--panel-2)/0.9))]"
    >
      <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-5 gap-0 border-x border-[hsl(var(--line)/0.35)]">
        {["20", "40", "60", "80"].map((gridOffset) => (
          <span
            key={gridOffset}
            className="border-r border-[hsl(var(--line)/0.35)]"
          />
        ))}
      </div>
      {items.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[hsl(var(--muted))]">
          최근 10분 activity 없음
        </div>
      ) : null}
      {items.map((item) => {
        const startedAt = new Date(item.started_at).getTime();
        const endedAt = new Date(item.ended_at ?? item.started_at).getTime();
        const clampedStart = Math.max(startedAt, windowStart);
        const clampedEnd = Math.min(Math.max(endedAt, clampedStart), windowEnd);
        const left = ((clampedStart - windowStart) / windowDuration) * 100;
        const width =
          Math.max(((clampedEnd - clampedStart) / windowDuration) * 100, 1.6) ||
          1.6;

        return (
          <span
            key={`${item.kind}-${item.started_at}-${item.ended_at ?? "open"}`}
            data-testid={`${timelineId}-${item.kind}-${item.started_at}`}
            className={cn(
              "absolute top-1/2 h-3 -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(15,23,42,0.2)]",
              timelineSegmentClassMap[item.kind],
            )}
            style={{
              left: `${left}%`,
              width: `${width}%`,
            }}
          />
        );
      })}
    </div>
  );
}
