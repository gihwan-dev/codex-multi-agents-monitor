import { monitorActionHandlers } from "./reducerHandlers";
import type { MonitorAction, MonitorState } from "./types";

export function monitorStateReducer(
  state: MonitorState,
  action: MonitorAction,
): MonitorState {
  const handler = monitorActionHandlers[action.type] as (
    currentState: MonitorState,
    currentAction: MonitorAction,
  ) => MonitorState;

  return handler(state, action);
}
