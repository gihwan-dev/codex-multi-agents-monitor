import { type Dispatch, useEffect, useEffectEvent } from "react";
import type {
  GraphSceneRow,
  RunDataset,
  SelectionState,
} from "../../../entities/run";
import type { MonitorAction } from "../model/state";
import { isEditableKeyboardTarget } from "./keyboardTarget";

function collectVisibleEventIds(rows: GraphSceneRow[]) {
  return rows.flatMap((row) => (row.kind === "event" ? [row.eventId] : []));
}

function getNextVisibleEventId(
  visibleEventIds: string[],
  selection: SelectionState | null,
  direction: "next" | "previous",
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

interface UseMonitorKeyboardShortcutsOptions {
  dispatch: Dispatch<MonitorAction>;
  activeDataset: RunDataset | null;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}

interface MonitorKeyboardShortcutContext extends UseMonitorKeyboardShortcutsOptions {}

type MonitorKeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "ctrlKey" | "key" | "metaKey" | "preventDefault" | "target"
>;

export function dispatchMonitorKeyboardShortcut(
  event: MonitorKeyboardShortcutEvent,
  {
    dispatch,
    activeDataset,
    selection,
    graphRows,
  }: MonitorKeyboardShortcutContext,
) {
  if (isEditableKeyboardTarget(event.target)) {
    return;
  }

  if (!activeDataset) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dispatch({ type: "toggle-shortcuts" });
      return;
    }

    if (event.key === "?") {
      dispatch({ type: "toggle-shortcuts" });
    }
    return;
  }

  const visibleEventIds = collectVisibleEventIds(graphRows);
  const normalizedKey = event.key.toLowerCase();

  if ((event.metaKey || event.ctrlKey) && normalizedKey === "k") {
    event.preventDefault();
    dispatch({ type: "toggle-shortcuts" });
    return;
  }

  switch (normalizedKey) {
    case "i":
      dispatch({ type: "toggle-inspector" });
      break;
    case ".":
      dispatch({
        type: "toggle-follow-live",
        traceId: activeDataset.run.traceId,
      });
      break;
    case "c":
      dispatch({ type: "set-drawer-tab", tab: "context", open: true });
      break;
    case "?":
      dispatch({ type: "toggle-shortcuts" });
      break;
    case "arrowdown":
    case "arrowup": {
      const nextSelectionId = getNextVisibleEventId(
        visibleEventIds,
        selection,
        normalizedKey === "arrowdown" ? "next" : "previous",
      );
      if (!nextSelectionId) {
        break;
      }

      event.preventDefault();
      dispatch({
        type: "set-selection",
        selection: { kind: "event", id: nextSelectionId },
      });
      break;
    }
    default:
      break;
  }
}

export function useMonitorKeyboardShortcuts({
  dispatch,
  activeDataset,
  selection,
  graphRows,
}: UseMonitorKeyboardShortcutsOptions) {
  const keyHandler = useEffectEvent((event: KeyboardEvent) => {
    dispatchMonitorKeyboardShortcut(event, {
      dispatch,
      activeDataset,
      selection,
      graphRows,
    });
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
