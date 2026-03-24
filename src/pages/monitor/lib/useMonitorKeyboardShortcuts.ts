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

interface ShortcutHelpToggleOptions {
  event: MonitorKeyboardShortcutEvent;
  normalizedKey: string;
  dispatch: Dispatch<MonitorAction>;
}

interface SelectionNavigationOptions {
  graphRows: GraphSceneRow[];
  selection: SelectionState | null;
  direction: "next" | "previous";
}

interface DatasetShortcutActionOptions {
  normalizedKey: string;
  activeDataset: RunDataset;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}

interface ToggleShortcutActionOptions {
  normalizedKey: string;
  activeDataset: RunDataset;
}

interface SelectionShortcutActionOptions {
  normalizedKey: string;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}

interface DispatchShortcutActionOptions {
  event: MonitorKeyboardShortcutEvent;
  dispatch: Dispatch<MonitorAction>;
  shortcutDispatch: MonitorShortcutDispatch | null;
}

interface MonitorKeyboardShortcutOptions {
  event: MonitorKeyboardShortcutEvent;
  context: MonitorKeyboardShortcutContext;
}

interface DatasetShortcutDispatchOptions {
  event: MonitorKeyboardShortcutEvent;
  normalizedKey: string;
  context: Pick<
    MonitorKeyboardShortcutContext,
    "dispatch" | "activeDataset" | "selection" | "graphRows"
  >;
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

function handleShortcutHelpToggle(options: ShortcutHelpToggleOptions) {
  const { event, normalizedKey, dispatch } = options;
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
  options: SelectionNavigationOptions,
): MonitorShortcutDispatch | null {
  const { graphRows, selection, direction } = options;
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

function resolveToggleShortcutAction(
  options: ToggleShortcutActionOptions,
): MonitorShortcutDispatch | null {
  const { normalizedKey, activeDataset } = options;
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
    default:
      return null;
  }
}

function resolveSelectionShortcutAction(
  options: SelectionShortcutActionOptions,
): MonitorShortcutDispatch | null {
  const { normalizedKey, selection, graphRows } = options;

  switch (normalizedKey) {
    case "arrowdown":
      return buildSelectionNavigationAction({
        graphRows,
        selection,
        direction: "next",
      });
    case "arrowup":
      return buildSelectionNavigationAction({
        graphRows,
        selection,
        direction: "previous",
      });
    default:
      return null;
  }
}

function resolveDatasetShortcutAction(
  options: DatasetShortcutActionOptions,
): MonitorShortcutDispatch | null {
  return (
    resolveToggleShortcutAction(options) ?? resolveSelectionShortcutAction(options)
  );
}

function dispatchShortcutAction(options: DispatchShortcutActionOptions) {
  const { event, dispatch, shortcutDispatch } = options;
  if (!shortcutDispatch) {
    return;
  }

  if (shortcutDispatch.preventDefault) {
    event.preventDefault();
  }

  dispatch(shortcutDispatch.action);
}

function dispatchDatasetShortcutAction(
  options: DatasetShortcutDispatchOptions,
) {
  const {
    event,
    normalizedKey,
    context: { dispatch, activeDataset, selection, graphRows },
  } = options;
  if (!activeDataset) {
    return;
  }

  dispatchShortcutAction({
    event,
    dispatch,
    shortcutDispatch: resolveDatasetShortcutAction({
      normalizedKey,
      activeDataset,
      selection,
      graphRows,
    }),
  });
}

export function dispatchMonitorKeyboardShortcut(
  options: MonitorKeyboardShortcutOptions,
) {
  const {
    event,
    context: { dispatch, activeDataset, selection, graphRows },
  } = options;
  if (isEditableKeyboardTarget(event.target)) {
    return;
  }

  const normalizedKey = event.key.toLowerCase();
  if (handleShortcutHelpToggle({ event, normalizedKey, dispatch })) {
    return;
  }

  dispatchDatasetShortcutAction({
    event,
    normalizedKey,
    context: {
      dispatch,
      activeDataset,
      selection,
      graphRows,
      },
    });
}

export function useMonitorKeyboardShortcuts(
  options: UseMonitorKeyboardShortcutsOptions,
) {
  const { dispatch, activeDataset, selection, graphRows } = options;
  const keyHandler = useEffectEvent((event: KeyboardEvent) => {
    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        dispatch,
        activeDataset,
        selection,
        graphRows,
      },
    });
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
