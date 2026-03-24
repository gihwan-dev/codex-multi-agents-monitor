import type { PointerEvent as ReactPointerEvent } from "react";

function removePointerListeners(
  handleMove: (event: PointerEvent) => void,
  handleUp: () => void,
) {
  window.removeEventListener("pointermove", handleMove);
  window.removeEventListener("pointerup", handleUp);
  window.removeEventListener("pointercancel", handleUp);
}

function addPointerListeners(
  handleMove: (event: PointerEvent) => void,
  handleUp: () => void,
) {
  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);
}

export function getKeyboardPositionDelta(key: string, reverse: boolean) {
  if (key === "ArrowLeft") {
    return reverse ? 16 : -16;
  }

  if (key === "ArrowRight") {
    return reverse ? -16 : 16;
  }

  return null;
}

export function beginResizeDrag(options: {
  event: ReactPointerEvent<HTMLButtonElement>;
  position: number;
  reverse: boolean;
  onDrag: (width: number) => void;
}) {
  const { event, onDrag, position, reverse } = options;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  const startX = event.clientX;
  const startWidth = position;
  const handleMove = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX;
    onDrag(startWidth + (reverse ? -delta : delta));
  };
  const handleUp = () => removePointerListeners(handleMove, handleUp);

  addPointerListeners(handleMove, handleUp);
}
