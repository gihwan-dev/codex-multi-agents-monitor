import {
  buildRevealScrollTop,
  isRevealRangeVisible,
} from "./graphSelectionRevealMath";

interface SelectionRevealContext {
  element: HTMLDivElement;
  revealRange: { top: number; bottom: number; anchorY: number } | null;
}

interface BuildSelectionRevealResolutionOptions {
  availableCanvasHeight: number;
  renderedContentHeight: number;
  revealContext: SelectionRevealContext;
}

export function buildSelectionRevealResolution(
  options: BuildSelectionRevealResolutionOptions,
):
  | { kind: "handled" }
  | { element: HTMLDivElement; kind: "scroll"; nextScrollTop: number } {
  if (
    options.revealContext.revealRange === null ||
    isRevealRangeVisible(
      options.revealContext.element,
      options.revealContext.revealRange,
      options.availableCanvasHeight,
    )
  ) {
    return { kind: "handled" };
  }

  return {
    element: options.revealContext.element,
    kind: "scroll",
    nextScrollTop: buildRevealScrollTop({
      availableCanvasHeight: options.availableCanvasHeight,
      renderedContentHeight: options.renderedContentHeight,
      anchorY: options.revealContext.revealRange.anchorY,
    }),
  };
}
