import { Badge } from "../primitives/badge";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type StatusChipStatus,
} from "./StatusChip.constants";
import {
  buildStatusChipClassName,
  buildStatusChipStyle,
} from "./StatusChip.helpers";
import { StatusChipGlyph } from "./StatusChipGlyph";

export type { StatusChipStatus } from "./StatusChip.constants";

interface StatusChipProps {
  status: StatusChipStatus;
  subtle?: boolean;
  className?: string;
}

export function StatusChip({ status, subtle = false, className }: StatusChipProps) {
  const tone = STATUS_COLORS[status];
  const shellStyle = buildStatusChipStyle(tone, subtle);

  return (
    <Badge
      data-slot="monitor-status-chip"
      data-status={status}
      data-subtle={subtle ? "true" : "false"}
      variant="outline"
      className={buildStatusChipClassName(subtle, className)}
      style={shellStyle}
    >
      <StatusChipGlyph status={status} subtle={subtle} tone={tone} />
      <span>{STATUS_LABELS[status]}</span>
    </Badge>
  );
}
