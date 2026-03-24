import type { GraphSceneModel, RunStatus } from "../../../entities/run";

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
    <span
      aria-hidden="true"
      data-slot="graph-status-dot"
      data-status={status}
      className="mt-1 inline-flex size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: GRAPH_STATUS_COLORS[status] }}
    />
  );
}
