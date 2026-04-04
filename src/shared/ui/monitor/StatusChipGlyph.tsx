import { cn } from "../../lib";
import {
  STATUS_GLYPH_CLASS_NAMES,
  STATUS_GLYPH_SHAPES,
  type StatusChipStatus,
} from "./StatusChip.constants";

interface StatusChipGlyphProps {
  status: StatusChipStatus;
  subtle: boolean;
  tone: string;
}

interface StatusGlyphMarkProps {
  status: StatusChipStatus;
  tone: string;
  compact?: boolean;
  className?: string;
  slot?: string;
}

export function StatusGlyphMark({
  status,
  tone,
  compact = false,
  className,
  slot = "monitor-status-glyph",
}: StatusGlyphMarkProps) {
  const shape = STATUS_GLYPH_SHAPES[status];
  const shapeClassName = compact
    ? STATUS_GLYPH_CLASS_NAMES[shape].compact
    : STATUS_GLYPH_CLASS_NAMES[shape].regular;

  return (
    <span
      aria-hidden="true"
      data-slot={slot}
      data-status={status}
      data-shape={shape}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        compact ? "size-2" : "size-2.5",
        className,
      )}
      style={{ color: tone }}
    >
      <span className={shapeClassName} />
    </span>
  );
}

export function StatusChipGlyph({ status, subtle, tone }: StatusChipGlyphProps) {
  return <StatusGlyphMark status={status} tone={tone} compact={subtle} />;
}
