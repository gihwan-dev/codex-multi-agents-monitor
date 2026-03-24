import { type Dispatch, useEffect, useEffectEvent } from "react";
import type {
  GraphSceneRow,
  RunDataset,
  SelectionState,
} from "../../../entities/run";
import type { MonitorAction } from "../model/state";
import { isEditableKeyboardTarget } from "./keyboardTarget";
import {
  resolveDatasetShortcutAction,
  type MonitorShortcutDispatch,
} from "./monitorKeyboardShortcutActions";

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

interface ShortcutHelpToggleOptions {
  event: MonitorKeyboardShortcutEvent;
  normalizedKey: string;
  dispatch: Dispatch<MonitorAction>;
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
