export const RUN_STATUSES = [
  "queued",
  "running",
  "waiting",
  "blocked",
  "interrupted",
  "done",
  "failed",
  "cancelled",
  "stale",
  "disconnected",
] as const;

export const EVENT_TYPES = [
  "run.started",
  "run.finished",
  "run.failed",
  "run.cancelled",
  "agent.spawned",
  "agent.state_changed",
  "agent.finished",
  "llm.started",
  "llm.finished",
  "tool.started",
  "tool.finished",
  "handoff",
  "transfer",
  "error",
  "note",
  "user.prompt",
  "turn.started",
  "turn.finished",
] as const;

export const DRAWER_TABS = ["artifacts", "import", "context", "raw", "log"] as const;
export const EDGE_TYPES = ["spawn", "handoff", "transfer", "merge"] as const;
export const RUN_ENVIRONMENTS = ["Desktop", "Import", "Live"] as const;
export const LIVE_MODES = ["imported", "live"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type DrawerTab = (typeof DRAWER_TABS)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];
export type RunEnvironment = (typeof RUN_ENVIRONMENTS)[number];
export type LiveMode = (typeof LIVE_MODES)[number];
export type LiveConnection =
  | "live"
  | "stale"
  | "disconnected"
  | "reconnected"
  | "paused";

export type PromptLayerType =
  | "system"
  | "permissions"
  | "app-context"
  | "collaboration-mode"
  | "apps"
  | "skills-catalog"
  | "agents"
  | "environment"
  | "automation"
  | "delegated"
  | "user"
  | "skill"
  | "subagent-notification";
