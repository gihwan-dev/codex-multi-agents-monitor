import {
  beginResizeDrag,
  getKeyboardPositionDelta,
} from "./resizeHandleDrag";

interface ResizeHandleProps {
  label: string;
  reverse?: boolean;
  position: number;
  onDrag: (width: number) => void;
  onKeyboard: (width: number) => void;
}

export function ResizeHandle({
  label,
  reverse = false,
  position,
  onDrag,
  onKeyboard,
}: ResizeHandleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="resize-handle relative min-h-full w-[var(--resize-handle-hit-width)] cursor-ew-resize border-0 bg-transparent p-0 touch-none select-none max-[720px]:hidden after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:bg-white/8 after:transition-colors after:motion-reduce:transition-none after:content-[''] hover:after:bg-[var(--color-active)]/40 focus-visible:after:bg-[var(--color-active)]/55"
      data-slot="resize-handle"
      onKeyDown={(event) => {
        const delta = getKeyboardPositionDelta(event.key, reverse);
        if (delta !== null) {
          onKeyboard(position + delta);
        }
      }}
      onPointerDown={(event) =>
        beginResizeDrag({
          event,
          position,
          reverse,
          onDrag,
        })}
    />
  );
}
