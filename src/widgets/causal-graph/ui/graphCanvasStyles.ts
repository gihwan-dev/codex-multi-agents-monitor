import type { CSSProperties } from "react";
import type { RunStatus } from "../../../entities/run";

export const EDGE_COLORS: Record<string, string> = {
  handoff: "var(--color-handoff)",
  transfer: "var(--color-transfer)",
  spawn: "var(--color-active)",
  merge: "var(--color-graph-edge-merge)",
};

export const GRAPH_STATUS_COLORS: Record<RunStatus, string> = {
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

export function buildCardStyle(options: {
  eventType: string;
  selected: boolean;
  inPath: boolean;
}): CSSProperties {
  const { eventType, selected, inPath } = options;
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

  applySelectionState(base, inPath, selected);
  applyEventAccent(base, eventType);
  return base;
}

function applyPathState(base: CSSProperties, borderColor: string) {
  base.borderTopColor = borderColor;
  base.borderRightColor = borderColor;
  base.borderBottomColor = borderColor;
  base.borderLeftColor = borderColor;
}

function applyEventAccent(base: CSSProperties, eventType: string) {
  const accentHandler = EVENT_ACCENTS[eventType];
  if (accentHandler) {
    accentHandler(base);
  }
}

function applyAccentBorder(base: CSSProperties, color: string) {
  base.borderLeftWidth = 3;
  base.borderLeftStyle = "solid";
  base.borderLeftColor = color;
}

function applySelectionState(
  base: CSSProperties,
  inPath: boolean,
  selected: boolean,
) {
  if (inPath) {
    applyPathState(base, "var(--color-graph-card-border-in-path)");
    base.boxShadow = "var(--shadow-graph-card-in-path)";
  }

  if (selected) {
    applyPathState(base, "var(--color-graph-card-border-selected)");
    base.boxShadow = "var(--shadow-graph-card-selected)";
  }
}

const EVENT_ACCENTS: Record<string, (base: CSSProperties) => void> = {
  "user.prompt": (base) => {
    applyAccentBorder(base, "var(--color-active)");
    base.background = "var(--gradient-graph-card-user)";
  },
  "tool.started": (base) => {
    applyAccentBorder(base, "var(--color-transfer)");
  },
  "tool.finished": (base) => {
    applyAccentBorder(base, "var(--color-success)");
  },
  "llm.started": (base) => {
    base.borderStyle = "dashed";
    base.opacity = 0.8;
  },
  "agent.spawned": (base) => {
    applyAccentBorder(base, "var(--color-active)");
  },
  "agent.finished": (base) => {
    applyAccentBorder(base, "var(--color-graph-card-muted-accent)");
  },
  error: (base) => {
    applyAccentBorder(base, "var(--color-failed)");
    base.background = "var(--gradient-graph-card-error)";
  },
  note: (base) => {
    applyAccentBorder(base, "var(--color-graph-card-note-accent)");
    base.opacity = 0.85;
  },
  "turn.started": applyTurnAccent,
  "turn.finished": applyTurnAccent,
};

function applyTurnAccent(base: CSSProperties) {
  base.borderStyle = "dashed";
  base.borderRadius = 6;
  base.background = "transparent";
  base.boxShadow = "none";
  base.opacity = 0.6;
}
