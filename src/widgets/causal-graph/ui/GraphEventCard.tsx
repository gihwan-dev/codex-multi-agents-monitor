import type { GraphSceneModel, RunStatus } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { EventTypeGlyph } from "../../../shared/ui";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import {
  GraphStatusDot,
  resolveEventCardClasses,
} from "./GraphEventCardDecorations";
import { buildCardStyle } from "./graphCanvasStyles";

interface GraphEventCardProps {
  eventId: string;
  eventLayout: GraphLayoutSnapshot["eventById"] extends Map<string, infer T>
    ? T
    : never;
  eventType: Extract<GraphSceneModel["rows"][number], { kind: "event" }>["eventType"];
  inPath: boolean;
  inputPreview: string | null;
  onSelect: () => void;
  outputPreview: string | null;
  rowAnchorTop: number;
  selected: boolean;
  status: RunStatus;
  summary: string;
  title: string;
}

export function GraphEventCard({
  eventId,
  eventLayout,
  eventType,
  inPath,
  inputPreview,
  onSelect,
  outputPreview,
  rowAnchorTop,
  selected,
  status,
  summary,
  title,
}: GraphEventCardProps) {
  const cardClasses = resolveEventCardClasses(eventType);
  const summaryLine = outputPreview ?? inputPreview ?? (summary !== "n/a" ? summary : null);

  return (
    <button
      type="button"
      data-slot="graph-event-card"
      data-event-id={eventId}
      data-event-type={eventType}
      data-selected={selected ? "true" : "false"}
      data-in-path={inPath ? "true" : "false"}
      className={cn(
        "absolute left-1/2 z-[1] grid h-20 min-h-20 -translate-x-1/2 content-center gap-1 rounded-[14px] px-3 py-2.5 text-left text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        cardClasses,
      )}
      style={{
        ...buildCardStyle({ eventType, selected, inPath }),
        top: `${eventLayout.cardRect.y - rowAnchorTop}px`,
        width: `${eventLayout.cardRect.width}px`,
      }}
      onClick={onSelect}
      aria-label={`${title} ${status}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <span className="flex min-w-0 items-start gap-1.5">
          <EventTypeGlyph eventType={eventType} size={13} />
          <strong className="line-clamp-2 text-[0.92rem] leading-[1.08] [overflow-wrap:anywhere]">
            {title}
          </strong>
        </span>
        <GraphStatusDot status={status} />
      </div>
      {summaryLine ? (
        <p
          data-slot="graph-card-summary"
          className="line-clamp-2 text-[0.72rem] leading-[1.3] text-[var(--color-text-muted)]"
        >
          {summaryLine}
        </p>
      ) : null}
    </button>
  );
}
