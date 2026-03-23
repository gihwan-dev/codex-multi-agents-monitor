import type { DrawerTab } from "../../../entities/run";

export const INSPECTOR_PAYLOAD_ACTIONS: Array<{ tab: DrawerTab; label: string }> = [
  { tab: "artifacts", label: "Artifacts" },
  { tab: "context", label: "Context" },
  { tab: "log", label: "Log" },
  { tab: "raw", label: "Raw" },
];
