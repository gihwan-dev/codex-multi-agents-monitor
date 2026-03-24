import type {
  GraphSceneRow,
  RunDataset,
  SelectionState,
} from "../../../entities/run";
import { resolveSelectionShortcutAction } from "./monitorKeyboardSelectionActions";
import type { MonitorShortcutDispatch } from "./monitorKeyboardShortcutTypes";
import { resolveToggleShortcutAction } from "./monitorKeyboardToggleActions";

export type { MonitorShortcutDispatch } from "./monitorKeyboardShortcutTypes";

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
