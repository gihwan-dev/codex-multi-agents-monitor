import type { GraphSceneModel } from "../../../entities/run";

export function resolveViewportFocusEventId(rows: GraphSceneModel["rows"]) {
  return rows.find((row) => row.kind === "event")?.eventId ?? null;
}
