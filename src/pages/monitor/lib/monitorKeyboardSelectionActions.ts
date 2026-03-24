import type { GraphSceneRow, SelectionState } from "../../../entities/run";
import { buildSelectionNavigationAction } from "./monitorKeyboardSelectionNavigation";
import type { MonitorShortcutDispatch } from "./monitorKeyboardShortcutTypes";

interface ResolveSelectionShortcutActionOptions {
  normalizedKey: string;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
}

export function resolveSelectionShortcutAction(
  options: ResolveSelectionShortcutActionOptions,
): MonitorShortcutDispatch | null {
  switch (options.normalizedKey) {
    case "arrowdown":
      return buildSelectionNavigationAction({ graphRows: options.graphRows, selection: options.selection, direction: "next" });
    case "arrowup":
      return buildSelectionNavigationAction({ graphRows: options.graphRows, selection: options.selection, direction: "previous" });
    default:
      return null;
  }
}
