import { clamp } from "./graphSelectionReveal";

export function isRevealRangeVisible(
  element: HTMLDivElement,
  revealRange: { top: number; bottom: number },
  availableCanvasHeight: number,
) {
  const visibleTop = element.scrollTop;
  const visibleBottom = visibleTop + availableCanvasHeight;
  return revealRange.top >= visibleTop && revealRange.bottom <= visibleBottom;
}

export function buildRevealScrollTop(options: {
  availableCanvasHeight: number;
  renderedContentHeight: number;
  anchorY: number;
}) {
  const maxScrollTop = Math.max(
    0,
    options.renderedContentHeight - options.availableCanvasHeight,
  );
  return clamp(options.anchorY - options.availableCanvasHeight / 2, 0, maxScrollTop);
}
