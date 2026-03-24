import type { GraphSceneRowEvent, SelectionState } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { EventTypeGlyph } from "../../../shared/ui";
import { buildGraphCardStyle } from "../lib/graphPresentation";
import type { EventLayout } from "../model/graphLayout";
import { GraphStatusDot } from "./GraphStatusDot";

interface CausalGraphEventCardProps {
  eventLayout: EventLayout | null;
  onSelect: (selection: SelectionState) => void;
  row: GraphSceneRowEvent;
}

export function CausalGraphEventCard({
  eventLayout,
  onSelect,
  row,
}: CausalGraphEventCardProps) {
  if (!eventLayout) {
    return null;
  }

  return (
    <button
      type="button"
      data-slot="graph-event-card"
      data-event-id={row.eventId}
      data-event-type={row.eventType}
      data-selected={row.selected ? "true" : "false"}
      data-in-path={row.inPath ? "true" : "false"}
      className={cn(
        "absolute left-1/2 z-[1] grid h-20 min-h-20 -translate-x-1/2 content-center gap-1 rounded-[14px] px-3 py-2.5 text-left text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        row.eventType === "tool.started" || row.eventType === "tool.finished"
          ? "rounded-lg"
          : "",
        (row.eventType === "turn.started" || row.eventType === "turn.finished") &&
          "rounded-md",
      )}
      style={{
        ...buildGraphCardStyle(row.eventType, row.selected, row.inPath),
        top: `${eventLayout.cardRect.y - eventLayout.rowTop}px`,
        width: `${eventLayout.cardRect.width}px`,
      }}
      onClick={() => onSelect({ kind: "event", id: row.eventId })}
      aria-label={`${row.title} ${row.status}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <span className="flex min-w-0 items-start gap-1.5">
          <EventTypeGlyph eventType={row.eventType} size={13} />
          <strong className="line-clamp-2 text-[0.92rem] leading-[1.08] [overflow-wrap:anywhere]">
            {row.title}
          </strong>
        </span>
        <GraphStatusDot status={row.status} />
      </div>
      {row.summary !== "n/a" ? (
        <p
          data-slot="graph-card-summary"
          className="line-clamp-2 text-[0.72rem] leading-[1.3] text-[var(--color-text-muted)]"
        >
          {row.summary}
        </p>
      ) : null}
    </button>
  );
}
