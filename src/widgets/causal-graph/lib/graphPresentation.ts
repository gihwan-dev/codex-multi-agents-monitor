import type { CSSProperties } from "react";
import type { EventType, RunStatus } from "../../../entities/run";

const EDGE_COLORS = {
  handoff: "var(--color-handoff)",
  transfer: "var(--color-transfer)",
  spawn: "var(--color-active)",
  merge: "var(--color-graph-edge-merge)",
} as const;

const GRAPH_STATUS_COLORS: Record<RunStatus, string> = {
  queued: "var(--color-text-tertiary)",
  running: "var(--color-active)",
  waiting: "var(--color-waiting)",
  blocked: "var(--color-blocked)",
  interrupted: "var(--color-transfer)",
  done: "var(--color-success)",
  failed: "var(--color-failed)",
  cancelled: "var(--color-text-tertiary)",
  stale: "var(--color-stale)",
  disconnected: "var(--color-disconnected)",
};

export function resolveGraphEdgeColor(edgeType: keyof typeof EDGE_COLORS) {
  return EDGE_COLORS[edgeType] ?? "var(--color-graph-edge-neutral)";
}

export function resolveGraphStatusColor(status: RunStatus) {
  return GRAPH_STATUS_COLORS[status];
}

export function buildGraphCardStyle(
  eventType: EventType,
  selected: boolean,
  inPath: boolean,
): CSSProperties {
  const base: CSSProperties = {
    minHeight: 80,
    borderWidth: 1,
    borderStyle: "solid",
    borderTopColor: "var(--color-graph-card-border)",
    borderRightColor: "var(--color-graph-card-border)",
    borderBottomColor: "var(--color-graph-card-border)",
    borderLeftColor: "var(--color-graph-card-border)",
    background: "var(--gradient-graph-card-surface)",
    boxShadow: "var(--shadow-graph-card)",
  };

  if (inPath) {
    base.borderTopColor = "var(--color-graph-card-border-in-path)";
    base.borderRightColor = "var(--color-graph-card-border-in-path)";
    base.borderBottomColor = "var(--color-graph-card-border-in-path)";
    base.borderLeftColor = "var(--color-graph-card-border-in-path)";
    base.boxShadow = "var(--shadow-graph-card-in-path)";
  }

  if (selected) {
    base.borderTopColor = "var(--color-graph-card-border-selected)";
    base.borderRightColor = "var(--color-graph-card-border-selected)";
    base.borderBottomColor = "var(--color-graph-card-border-selected)";
    base.borderLeftColor = "var(--color-graph-card-border-selected)";
    base.boxShadow = "var(--shadow-graph-card-selected)";
  }

  switch (eventType) {
    case "user.prompt":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-active)";
      base.background = "var(--gradient-graph-card-user)";
      break;
    case "tool.started":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-transfer)";
      break;
    case "tool.finished":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-success)";
      break;
    case "llm.started":
      base.borderStyle = "dashed";
      base.opacity = 0.8;
      break;
    case "agent.spawned":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-active)";
      break;
    case "agent.finished":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-graph-card-muted-accent)";
      break;
    case "error":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-failed)";
      base.background = "var(--gradient-graph-card-error)";
      break;
    case "note":
      base.borderLeftWidth = 3;
      base.borderLeftStyle = "solid";
      base.borderLeftColor = "var(--color-graph-card-note-accent)";
      base.opacity = 0.85;
      break;
    case "turn.started":
    case "turn.finished":
      base.borderStyle = "dashed";
      base.borderRadius = 6;
      base.background = "transparent";
      base.boxShadow = "none";
      base.opacity = 0.6;
      break;
    default:
      break;
  }

  return base;
}
