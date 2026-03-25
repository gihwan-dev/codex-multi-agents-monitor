import type { RunDataset } from "../../../entities/run";
import type { MonitorShortcutDispatch } from "./monitorKeyboardShortcutTypes";

interface ResolveToggleShortcutActionOptions {
  normalizedKey: string;
  activeDataset: RunDataset;
}

export function resolveToggleShortcutAction(
  options: ResolveToggleShortcutActionOptions,
): MonitorShortcutDispatch | null {
  switch (options.normalizedKey) {
    case ".":
      return { action: { type: "toggle-follow-live", traceId: options.activeDataset.run.traceId } };
    case "c":
      return { action: { type: "set-drawer-tab", tab: "context", open: true } };
    default:
      return null;
  }
}
