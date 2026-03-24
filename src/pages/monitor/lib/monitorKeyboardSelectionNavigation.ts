import type { GraphSceneRow, SelectionState } from "../../../entities/run";
import type { MonitorShortcutDispatch } from "./monitorKeyboardShortcutTypes";

type KeyboardShortcutDirection = "next" | "previous";

function collectVisibleEventIds(rows: GraphSceneRow[]) {
  return rows.flatMap((row) => (row.kind === "event" ? [row.eventId] : []));
}

function getNextVisibleEventId(
  visibleEventIds: string[],
  selection: SelectionState | null,
  direction: KeyboardShortcutDirection,
) {
  if (!visibleEventIds.length) {
    return null;
  }

  const currentIndex = selection ? visibleEventIds.indexOf(selection.id) : -1;
  const nextIndex = direction === "next" ? Math.min(currentIndex + 1, visibleEventIds.length - 1) : Math.max(currentIndex - 1, 0);
  return visibleEventIds[nextIndex] ?? null;
}

export function buildSelectionNavigationAction(options: {
  graphRows: GraphSceneRow[];
  selection: SelectionState | null;
  direction: KeyboardShortcutDirection;
}): MonitorShortcutDispatch | null {
  const nextSelectionId = getNextVisibleEventId(
    collectVisibleEventIds(options.graphRows),
    options.selection,
    options.direction,
  );
  return nextSelectionId
    ? { preventDefault: true, action: { type: "navigate-selection", selection: { kind: "event", id: nextSelectionId } } }
    : null;
}
