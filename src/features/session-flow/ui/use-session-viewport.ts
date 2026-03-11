import { useCallback, useRef, useState } from "react";

type ViewBoxState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseSessionViewportOptions = {
  width: number;
  height: number;
};

export function useSessionViewport({
  width,
  height,
}: UseSessionViewportOptions) {
  const [viewBox, setViewBox] = useState<ViewBoxState>({
    x: 0,
    y: 0,
    width,
    height,
  });
  const dragState = useRef<{
    pointerX: number;
    pointerY: number;
    viewBox: ViewBoxState;
  } | null>(null);

  const reset = useCallback(() => {
    setViewBox({
      x: 0,
      y: 0,
      width,
      height,
    });
  }, [height, width]);

  const syncBounds = useCallback(() => {
    setViewBox((current) =>
      current.width === width && current.height === height
        ? current
        : {
            x: 0,
            y: 0,
            width,
            height,
          },
    );
  }, [height, width]);

  function zoom(multiplier: number) {
    setViewBox((current) => {
      const nextWidth = current.width * multiplier;
      const nextHeight = current.height * multiplier;
      return {
        x: current.x - (nextWidth - current.width) / 2,
        y: current.y - (nextHeight - current.height) / 2,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function onPointerDown(clientX: number, clientY: number) {
    dragState.current = {
      pointerX: clientX,
      pointerY: clientY,
      viewBox,
    };
  }

  function onPointerMove(clientX: number, clientY: number, bounds: DOMRect) {
    if (!dragState.current) {
      return;
    }

    const widthRatio = dragState.current.viewBox.width / bounds.width;
    const heightRatio = dragState.current.viewBox.height / bounds.height;
    const deltaX = (dragState.current.pointerX - clientX) * widthRatio;
    const deltaY = (dragState.current.pointerY - clientY) * heightRatio;
    setViewBox({
      ...dragState.current.viewBox,
      x: dragState.current.viewBox.x + deltaX,
      y: dragState.current.viewBox.y + deltaY,
    });
  }

  function clearDrag() {
    dragState.current = null;
  }

  return {
    viewBox,
    zoom,
    reset,
    syncBounds,
    onPointerDown,
    onPointerMove,
    clearDrag,
  };
}
