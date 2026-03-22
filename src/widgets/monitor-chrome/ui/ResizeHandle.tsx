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
      className="resize-handle relative min-h-full w-[var(--resize-handle-hit-width)] cursor-ew-resize border-0 bg-transparent p-0 touch-none select-none max-[720px]:hidden after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:bg-white/8 after:transition-colors after:content-[''] hover:after:bg-[var(--color-active)]/40 focus-visible:after:bg-[var(--color-active)]/55"
      data-slot="resize-handle"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          onKeyboard(position + (reverse ? 16 : -16));
        }
        if (event.key === "ArrowRight") {
          onKeyboard(position + (reverse ? -16 : 16));
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const startWidth = position;
        const handleMove = (moveEvent: PointerEvent) => {
          const delta = moveEvent.clientX - startX;
          onDrag(startWidth + (reverse ? -delta : delta));
        };
        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          window.removeEventListener("pointercancel", handleUp);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        window.addEventListener("pointercancel", handleUp);
      }}
    />
  );
}
