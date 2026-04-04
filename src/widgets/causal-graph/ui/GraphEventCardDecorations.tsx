import type { GraphSceneModel, RunStatus } from "../../../entities/run";
import { StatusGlyphMark } from "../../../shared/ui/monitor";

import { GRAPH_STATUS_COLORS } from "./graphCanvasStyles";

export function resolveEventCardClasses(
  eventType: Extract<GraphSceneModel["rows"][number], { kind: "event" }>["eventType"],
) {
  if (eventType === "tool.started" || eventType === "tool.finished") {
    return "rounded-lg";
  }

  return eventType === "turn.started" || eventType === "turn.finished" ? "rounded-md" : "";
}

export function GraphStatusDot({ status }: { status: RunStatus }) {
  return (
    <StatusGlyphMark
      status={status}
      tone={GRAPH_STATUS_COLORS[status]}
      className="mt-1"
      slot="graph-status-dot"
    />
  );
}
