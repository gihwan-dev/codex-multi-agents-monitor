import type { GraphSceneModel, RunStatus } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { GraphEventCardContent } from "./GraphEventCardContent";
import { resolveEventCardClasses } from "./GraphEventCardDecorations";
import { buildCardStyle } from "./graphCanvasStyles";
import {
  resolveBooleanDataFlag,
  resolveSummaryLine,
} from "./graphEventCardHelpers";

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
  totalTokens: number;
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
  totalTokens,
  title,
}: GraphEventCardProps) {
  const cardClasses = resolveEventCardClasses(eventType);
  const summaryLine = resolveSummaryLine(outputPreview, inputPreview, summary);

  return (
    <button
      type="button"
      data-slot="graph-event-card"
      data-event-id={eventId}
      data-event-type={eventType}
      data-selected={resolveBooleanDataFlag(selected)}
      data-in-path={resolveBooleanDataFlag(inPath)}
      className={cn(
        "absolute z-[1] grid h-20 min-h-20 content-center gap-1 rounded-[14px] px-3 py-2.5 text-left text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        cardClasses,
      )}
      style={{
        ...buildCardStyle({ eventType, selected, inPath }),
        left: `${eventLayout.cardRect.x}px`,
        top: `${eventLayout.cardRect.y - rowAnchorTop}px`,
        width: `${eventLayout.cardRect.width}px`,
      }}
      onClick={onSelect}
      aria-label={`${title} ${status}`}
    >
      <GraphEventCardContent
        eventType={eventType}
        status={status}
        summaryLine={summaryLine}
        title={title}
        totalTokens={totalTokens}
      />
    </button>
  );
}
