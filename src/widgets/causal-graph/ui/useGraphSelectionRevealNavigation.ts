import { type RefObject, useEffect } from "react";
import type { GraphSelectionRevealTarget } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import {
  clamp,
  prefersReducedMotion,
  resolveSelectionRevealRange,
} from "./graphSelectionReveal";

interface UseGraphSelectionRevealNavigationOptions {
  availableCanvasHeight: number;
  lastHandledNavigationRequestIdRef: RefObject<number>;
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
  runTraceId: string;
  scheduleScrollTopUpdate: (nextScrollTop: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectionNavigationRunId: string | null;
  selectionNavigationRequestId: number;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
}

export function useGraphSelectionRevealNavigation(
  options: UseGraphSelectionRevealNavigationOptions,
) {
  useEffect(() => {
    navigateSelectionReveal(options);
  }, [options]);
}

function navigateSelectionReveal({
  availableCanvasHeight,
  lastHandledNavigationRequestIdRef,
  layout,
  renderedContentHeight,
  runTraceId,
  scheduleScrollTopUpdate,
  scrollRef,
  selectionNavigationRunId,
  selectionNavigationRequestId,
  selectionRevealTarget,
}: UseGraphSelectionRevealNavigationOptions) {
  const resolution = resolveSelectionRevealNavigation({
    availableCanvasHeight,
    lastHandledNavigationRequestIdRef,
    layout,
    renderedContentHeight,
    runTraceId,
    scrollRef,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
  });
  if (resolution.kind === "skip") {
    return;
  }

  lastHandledNavigationRequestIdRef.current = selectionNavigationRequestId;
  if (resolution.kind !== "scroll") {
    return;
  }

  scrollToRevealTarget(resolution.element, resolution.nextScrollTop);
  scheduleScrollTopUpdate(resolution.nextScrollTop);
}

function isRevealRangeVisible(
  element: HTMLDivElement,
  revealRange: { top: number; bottom: number },
  availableCanvasHeight: number,
) {
  const visibleTop = element.scrollTop;
  const visibleBottom = visibleTop + availableCanvasHeight;
  return revealRange.top >= visibleTop && revealRange.bottom <= visibleBottom;
}

function resolveSelectionRevealNavigation({
  availableCanvasHeight,
  lastHandledNavigationRequestIdRef,
  layout,
  renderedContentHeight,
  runTraceId,
  scrollRef,
  selectionNavigationRunId,
  selectionNavigationRequestId,
  selectionRevealTarget,
}: Omit<UseGraphSelectionRevealNavigationOptions, "scheduleScrollTopUpdate">):
  | { kind: "skip" }
  | { kind: "handled" }
  | { element: HTMLDivElement; kind: "scroll"; nextScrollTop: number } {
  if (
    shouldSkipSelectionReveal({
      lastHandledNavigationRequestIdRef,
      runTraceId,
      selectionNavigationRunId,
      selectionNavigationRequestId,
    })
  ) {
    return { kind: "skip" };
  }

  const revealContext = readSelectionRevealContext({
    availableCanvasHeight,
    layout,
    scrollRef,
    selectionRevealTarget,
  });
  if (!revealContext) {
    return { kind: "skip" };
  }

  return buildSelectionRevealResolution(
    availableCanvasHeight,
    renderedContentHeight,
    revealContext,
  );
}

function shouldSkipSelectionReveal(
  options: {
    lastHandledNavigationRequestIdRef: RefObject<number>;
    runTraceId: string;
    selectionNavigationRunId: string | null;
    selectionNavigationRequestId: number;
  },
) {
  return (
    options.selectionNavigationRequestId === 0 ||
    options.selectionNavigationRunId !== options.runTraceId ||
    options.selectionNavigationRequestId <= options.lastHandledNavigationRequestIdRef.current
  );
}

function readSelectionRevealContext(
  options: {
    availableCanvasHeight: number;
    layout: GraphLayoutSnapshot;
    scrollRef: RefObject<HTMLDivElement | null>;
    selectionRevealTarget: GraphSelectionRevealTarget | null;
  },
) {
  const element = options.scrollRef.current;
  if (!element || options.availableCanvasHeight <= 0) {
    return null;
  }

  return {
    element,
    revealRange: resolveSelectionRevealRange(
      options.selectionRevealTarget,
      options.layout,
    ),
  };
}

function buildSelectionRevealResolution(
  availableCanvasHeight: number,
  renderedContentHeight: number,
  revealContext: {
    element: HTMLDivElement;
    revealRange: ReturnType<typeof resolveSelectionRevealRange>;
  },
):
  | { kind: "handled" }
  | { element: HTMLDivElement; kind: "scroll"; nextScrollTop: number } {
  if (
    revealContext.revealRange === null ||
    isRevealRangeVisible(
      revealContext.element,
      revealContext.revealRange,
      availableCanvasHeight,
    )
  ) {
    return { kind: "handled" };
  }

  return {
    element: revealContext.element,
    kind: "scroll",
    nextScrollTop: buildRevealScrollTop(
      availableCanvasHeight,
      renderedContentHeight,
      revealContext.revealRange.anchorY,
    ),
  };
}

function buildRevealScrollTop(
  availableCanvasHeight: number,
  renderedContentHeight: number,
  anchorY: number,
) {
  const maxScrollTop = Math.max(0, renderedContentHeight - availableCanvasHeight);
  return clamp(anchorY - availableCanvasHeight / 2, 0, maxScrollTop);
}

function scrollToRevealTarget(element: HTMLDivElement, nextScrollTop: number) {
  element.scrollTo({
    top: nextScrollTop,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
