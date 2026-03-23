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

interface MonitorShortcutDispatch {
  action: MonitorAction;
  preventDefault?: boolean;
}

function isShortcutHelpKey(
  event: MonitorKeyboardShortcutEvent,
  normalizedKey: string,
) {
  return (
    ((event.metaKey || event.ctrlKey) && normalizedKey === "k") ||
    normalizedKey === "?"
  );
}

function handleShortcutHelpToggle(
  event: MonitorKeyboardShortcutEvent,
  normalizedKey: string,
  dispatch: Dispatch<MonitorAction>,
) {
  if (!isShortcutHelpKey(event, normalizedKey)) {
    return false;
  }

  if (normalizedKey === "k") {
    event.preventDefault();
  }

  dispatch({ type: "toggle-shortcuts" });
  return true;
}

function buildSelectionNavigationAction(
  graphRows: GraphSceneRow[],
  selection: SelectionState | null,
  direction: "next" | "previous",
): MonitorShortcutDispatch | null {
  const nextSelectionId = getNextVisibleEventId(
    collectVisibleEventIds(graphRows),
    selection,
    direction,
  );
  if (!nextSelectionId) {
    return null;
  }

  return {
    preventDefault: true,
    action: {
      type: "navigate-selection",
      selection: { kind: "event", id: nextSelectionId },
    },
  };
}

function resolveDatasetShortcutAction({
  normalizedKey,
  activeDataset,
  selection,
  graphRows,
}: {
  normalizedKey: string;
  activeDataset: RunDataset;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}): MonitorShortcutDispatch | null {
  switch (normalizedKey) {
    case "i":
      return { action: { type: "toggle-inspector" } };
    case ".":
      return {
        action: {
          type: "toggle-follow-live",
          traceId: activeDataset.run.traceId,
        },
      };
    case "c":
      return { action: { type: "set-drawer-tab", tab: "context", open: true } };
    case "arrowdown":
      return buildSelectionNavigationAction(graphRows, selection, "next");
    case "arrowup":
      return buildSelectionNavigationAction(graphRows, selection, "previous");
    default:
      return null;
  }
}

function dispatchShortcutAction(
  event: MonitorKeyboardShortcutEvent,
  dispatch: Dispatch<MonitorAction>,
  shortcutDispatch: MonitorShortcutDispatch | null,
) {
  if (!shortcutDispatch) {
    return;
  }

  if (shortcutDispatch.preventDefault) {
    event.preventDefault();
  }

  dispatch(shortcutDispatch.action);
}

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

  const normalizedKey = event.key.toLowerCase();
  if (handleShortcutHelpToggle(event, normalizedKey, dispatch)) {
    return;
  }

  if (!activeDataset) {
    return;
  }

  dispatchShortcutAction(
    event,
    dispatch,
    resolveDatasetShortcutAction({
      normalizedKey,
      activeDataset,
      selection,
      graphRows,
    }),
  );
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
