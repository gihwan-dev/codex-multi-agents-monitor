import type { GraphSceneRow, SelectionState } from "../../../entities/run";
import type { MonitorShortcutDispatch } from "./monitorKeyboardShortcutTypes";
import { buildSelectionNavigationAction } from "./monitorKeyboardSelectionNavigation";

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
