import type {
  GraphSceneRow,
  RunDataset,
  SelectionState,
} from "../../../entities/run";
import type { MonitorAction } from "../model/state";

type KeyboardShortcutDirection = "next" | "previous";

export interface MonitorShortcutDispatch {
  action: MonitorAction;
  preventDefault?: boolean;
}

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
  const nextIndex =
    direction === "next"
      ? Math.min(currentIndex + 1, visibleEventIds.length - 1)
      : Math.max(currentIndex - 1, 0);
  return visibleEventIds[nextIndex] ?? null;
}

function resolveToggleShortcutAction(options: {
  normalizedKey: string;
  activeDataset: RunDataset;
}): MonitorShortcutDispatch | null {
  switch (options.normalizedKey) {
    case "i":
      return { action: { type: "toggle-inspector" } };
    case ".":
      return {
        action: {
          type: "toggle-follow-live",
          traceId: options.activeDataset.run.traceId,
        },
      };
    case "c":
      return { action: { type: "set-drawer-tab", tab: "context", open: true } };
    default:
      return null;
  }
}

function resolveSelectionShortcutAction(options: {
  normalizedKey: string;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}): MonitorShortcutDispatch | null {
  switch (options.normalizedKey) {
    case "arrowdown":
      return buildSelectionNavigationAction({
        graphRows: options.graphRows,
        selection: options.selection,
        direction: "next",
      });
    case "arrowup":
      return buildSelectionNavigationAction({
        graphRows: options.graphRows,
        selection: options.selection,
        direction: "previous",
      });
    default:
      return null;
  }
}

function buildSelectionNavigationAction(options: {
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
    ? {
        preventDefault: true,
        action: {
          type: "navigate-selection",
          selection: { kind: "event", id: nextSelectionId },
        },
      }
    : null;
}

export function resolveDatasetShortcutAction(options: {
  normalizedKey: string;
  activeDataset: RunDataset;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}): MonitorShortcutDispatch | null {
  return (
    resolveToggleShortcutAction(options) ?? resolveSelectionShortcutAction(options)
  );
}
