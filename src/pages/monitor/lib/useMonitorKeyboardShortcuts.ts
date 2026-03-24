import { type Dispatch, useEffect, useEffectEvent } from "react";
import type {
  GraphSceneRow,
  RunDataset,
  SelectionState,
} from "../../../entities/run";
import type { MonitorAction } from "../model/state";
import { dispatchMonitorKeyboardShortcut } from "./monitorKeyboardShortcutDispatch";

export { dispatchMonitorKeyboardShortcut } from "./monitorKeyboardShortcutDispatch";

interface UseMonitorKeyboardShortcutsOptions {
  dispatch: Dispatch<MonitorAction>;
  activeDataset: RunDataset | null;
  selection: SelectionState | null;
  graphRows: GraphSceneRow[];
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
