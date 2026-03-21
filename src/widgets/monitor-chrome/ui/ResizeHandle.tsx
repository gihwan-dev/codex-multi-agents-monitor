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
      className="resize-handle min-h-full w-[2px] cursor-col-resize border-0 bg-white/8 p-0 transition-colors hover:bg-[var(--color-active)]/40 focus-visible:bg-[var(--color-active)]/55 max-[720px]:hidden"
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
        const startX = event.clientX;
        const startWidth = position;
        const handleMove = (moveEvent: PointerEvent) => {
          const delta = moveEvent.clientX - startX;
          onDrag(startWidth + (reverse ? -delta : delta));
        };
        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      }}
    />
  );
}
