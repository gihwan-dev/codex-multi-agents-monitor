import { cn } from "../../lib";
import type { StatusChipStatus } from "./StatusChip.constants";

interface StatusChipGlyphProps {
  status: StatusChipStatus;
  subtle: boolean;
  tone: string;
}

export function StatusChipGlyph({ status, subtle, tone }: StatusChipGlyphProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="monitor-status-glyph"
      data-status={status}
      className={cn("shrink-0 rounded-full", subtle ? "size-2" : "size-2.5")}
      style={{ backgroundColor: tone }}
    />
  );
}
