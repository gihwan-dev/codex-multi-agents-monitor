import type { MonitorAction } from "../model/state";

export interface MonitorShortcutDispatch {
  action: MonitorAction;
  preventDefault?: boolean;
}
