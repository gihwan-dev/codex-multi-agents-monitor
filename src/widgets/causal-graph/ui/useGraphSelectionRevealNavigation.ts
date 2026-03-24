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

interface ResolveSelectionRevealNavigationOptions {
  availableCanvasHeight: number;
  lastHandledNavigationRequestIdRef: RefObject<number>;
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
  runTraceId: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectionNavigationRunId: string | null;
  selectionNavigationRequestId: number;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
}

interface SelectionRevealContext {
  element: HTMLDivElement;
  revealRange: ReturnType<typeof resolveSelectionRevealRange>;
}

interface BuildSelectionRevealResolutionOptions {
  availableCanvasHeight: number;
  renderedContentHeight: number;
  revealContext: SelectionRevealContext;
}

export function useGraphSelectionRevealNavigation(
  options: UseGraphSelectionRevealNavigationOptions,
) {
  useEffect(() => {
    navigateSelectionReveal(options);
  }, [options]);
}

function navigateSelectionReveal(options: UseGraphSelectionRevealNavigationOptions) {
  const resolution = readSelectionRevealNavigation(options);
  if (resolution.kind === "skip") {
    return;
  }

  applySelectionRevealResolution(options, resolution);
}

function readSelectionRevealNavigation(
  options: UseGraphSelectionRevealNavigationOptions,
) {
  const {
    availableCanvasHeight,
    lastHandledNavigationRequestIdRef,
    layout,
    renderedContentHeight,
    runTraceId,
    scrollRef,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
  } = options;
  return resolveSelectionRevealNavigation({
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
}

function applySelectionRevealResolution(
  options: UseGraphSelectionRevealNavigationOptions,
  resolution: ReturnType<typeof resolveSelectionRevealNavigation>,
) {
  const {
    lastHandledNavigationRequestIdRef,
    scheduleScrollTopUpdate,
    selectionNavigationRequestId,
  } = options;
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

function resolveSelectionRevealNavigation(
  options: ResolveSelectionRevealNavigationOptions,
):
  | { kind: "skip" }
  | { kind: "handled" }
  | { element: HTMLDivElement; kind: "scroll"; nextScrollTop: number } {
  const {
    availableCanvasHeight,
    lastHandledNavigationRequestIdRef,
    layout,
    renderedContentHeight,
    runTraceId,
    scrollRef,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
  } = options;
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

  return buildSelectionRevealResolution({
    availableCanvasHeight,
    renderedContentHeight,
    revealContext,
  });
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
  options: BuildSelectionRevealResolutionOptions,
):
  | { kind: "handled" }
  | { element: HTMLDivElement; kind: "scroll"; nextScrollTop: number } {
  const { availableCanvasHeight, renderedContentHeight, revealContext } = options;
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
