import { isEditableKeyboardTarget } from "./keyboardTarget";
import {
  type MonitorShortcutDispatch,
  resolveDatasetShortcutAction,
} from "./monitorKeyboardShortcutActions";

interface MonitorKeyboardShortcutContext {
  dispatch: (action: MonitorShortcutDispatch["action"]) => void;
  activeDataset: Parameters<typeof resolveDatasetShortcutAction>[0]["activeDataset"] | null;
  selection: Parameters<typeof resolveDatasetShortcutAction>[0]["selection"];
  graphRows: Parameters<typeof resolveDatasetShortcutAction>[0]["graphRows"];
}

type MonitorKeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "ctrlKey" | "key" | "metaKey" | "preventDefault" | "target"
>;

interface MonitorKeyboardShortcutOptions {
  event: MonitorKeyboardShortcutEvent;
  context: MonitorKeyboardShortcutContext;
}

function isShortcutHelpKey(event: MonitorKeyboardShortcutEvent, normalizedKey: string) {
  return ((event.metaKey || event.ctrlKey) && normalizedKey === "k") || normalizedKey === "?";
}

function handleShortcutHelpToggle(options: {
  event: MonitorKeyboardShortcutEvent;
  normalizedKey: string;
  dispatch: MonitorKeyboardShortcutContext["dispatch"];
}) {
  if (!isShortcutHelpKey(options.event, options.normalizedKey)) {
    return false;
  }

  if (options.normalizedKey === "k") {
    options.event.preventDefault();
  }

  options.dispatch({ type: "toggle-shortcuts" });
  return true;
}

function dispatchShortcutAction(options: {
  event: MonitorKeyboardShortcutEvent;
  dispatch: MonitorKeyboardShortcutContext["dispatch"];
  shortcutDispatch: MonitorShortcutDispatch | null;
}) {
  if (!options.shortcutDispatch) {
    return;
  }

  if (options.shortcutDispatch.preventDefault) {
    options.event.preventDefault();
  }

  options.dispatch(options.shortcutDispatch.action);
}

function readDatasetShortcutDispatch(
  context: MonitorKeyboardShortcutContext,
  normalizedKey: string,
) {
  return context.activeDataset
    ? resolveDatasetShortcutAction({
        normalizedKey,
        activeDataset: context.activeDataset,
        selection: context.selection,
        graphRows: context.graphRows,
      })
    : null;
}

export function dispatchMonitorKeyboardShortcut(options: MonitorKeyboardShortcutOptions) {
  const { event, context } = options;
  if (isEditableKeyboardTarget(event.target)) {
    return;
  }

  const normalizedKey = event.key.toLowerCase();
  if (handleShortcutHelpToggle({ event, normalizedKey, dispatch: context.dispatch })) {
    return;
  }

  dispatchShortcutAction({
    event,
    dispatch: context.dispatch,
    shortcutDispatch: readDatasetShortcutDispatch(context, normalizedKey),
  });
}
