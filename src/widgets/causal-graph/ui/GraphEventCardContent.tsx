import type { GraphSceneModel, RunStatus } from "../../../entities/run";
import { formatTokens } from "../../../shared/lib/format";
import { EventTypeGlyph } from "../../../shared/ui";
import { GraphStatusDot } from "./GraphEventCardDecorations";

interface GraphEventCardContentProps {
  eventType: Extract<GraphSceneModel["rows"][number], { kind: "event" }>["eventType"];
  status: RunStatus;
  summaryLine: string | null;
  title: string;
  totalTokens: number;
}

export function GraphEventCardContent({
  eventType,
  status,
  summaryLine,
  title,
  totalTokens,
}: GraphEventCardContentProps) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <span className="flex min-w-0 items-start gap-1.5">
          <EventTypeGlyph eventType={eventType} size={13} />
          <strong className="line-clamp-2 text-[0.92rem] leading-[1.08] [overflow-wrap:anywhere]" title={title}>
            {title}
          </strong>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {totalTokens > 0 ? (
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {formatTokens(totalTokens)}
            </span>
          ) : null}
          <GraphStatusDot status={status} />
        </span>
      </div>
      {summaryLine ? (
        <p
          data-slot="graph-card-summary"
          className="line-clamp-2 text-[0.72rem] leading-[1.3] text-[var(--color-text-muted)]"
          title={summaryLine}
        >
          {summaryLine}
        </p>
      ) : null}
    </>
  );
}
