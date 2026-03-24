import type { RunStatus } from "../../../entities/run";
import { resolveGraphStatusColor } from "../lib/graphPresentation";

interface GraphStatusDotProps {
  status: RunStatus;
}

export function GraphStatusDot({ status }: GraphStatusDotProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="graph-status-dot"
      data-status={status}
      className="mt-1 inline-flex size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: resolveGraphStatusColor(status) }}
    />
  );
}
