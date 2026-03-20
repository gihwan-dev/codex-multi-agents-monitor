import { type Dispatch, useEffect, useEffectEvent } from "react";
import type {
  GraphSceneRow,
  RunDataset,
  RunFilters,
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
  activeDataset: RunDataset;
  activeFilters: RunFilters;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}

export function useMonitorKeyboardShortcuts({
  dispatch,
  activeDataset,
  activeFilters,
  selection,
  graphRows,
}: UseMonitorKeyboardShortcutsOptions) {
  const keyHandler = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableKeyboardTarget(event.target)) {
      return;
    }

    const visibleEventIds = collectVisibleEventIds(graphRows);

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dispatch({ type: "toggle-shortcuts" });
      return;
    }

    switch (event.key.toLowerCase()) {
      case "i":
        dispatch({ type: "toggle-inspector" });
        break;
      case ".":
        dispatch({
          type: "toggle-follow-live",
          traceId: activeDataset.run.traceId,
        });
        break;
      case "e":
        dispatch({
          type: "set-filter",
          traceId: activeDataset.run.traceId,
          key: "errorOnly",
          value: !activeFilters.errorOnly,
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
          event.key.toLowerCase() === "arrowdown" ? "next" : "previous",
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
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
