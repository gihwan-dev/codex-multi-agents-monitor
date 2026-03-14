import type { RunStatus } from "../domain";

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Waiting",
  blocked: "Blocked",
  interrupted: "Interrupted",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  stale: "Stale",
  disconnected: "Disconnected",
};

const STATUS_SHAPES: Record<RunStatus, string> = {
  queued: "status-chip__glyph--queued",
  running: "status-chip__glyph--running",
  waiting: "status-chip__glyph--waiting",
  blocked: "status-chip__glyph--blocked",
  interrupted: "status-chip__glyph--interrupted",
  done: "status-chip__glyph--done",
  failed: "status-chip__glyph--failed",
  cancelled: "status-chip__glyph--cancelled",
  stale: "status-chip__glyph--stale",
  disconnected: "status-chip__glyph--disconnected",
};

interface StatusChipProps {
  status: RunStatus;
  subtle?: boolean;
}

export function StatusChip({ status, subtle = false }: StatusChipProps) {
  return (
    <span className={`status-chip ${subtle ? "status-chip--subtle" : ""}`.trim()}>
      <span className={`status-chip__glyph ${STATUS_SHAPES[status]}`} aria-hidden="true" />
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
