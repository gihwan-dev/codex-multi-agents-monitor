import { useMemo } from "react";
import {
  focusContextObservability,
  type GraphSceneModel,
} from "../../../entities/run";
import type { RowPosition } from "../model/graphLayout";
import { resolveViewportBottomEventId } from "./graphViewportFocus";

interface UseViewportGraphContextObservabilityArgs {
  availableCanvasHeight: number;
  scene: GraphSceneModel;
  scrollTop: number;
  visibleRowPositions: RowPosition[];
  visibleRows: GraphSceneModel["rows"];
}

export function useViewportGraphContextObservability(
  args: UseViewportGraphContextObservabilityArgs,
) {
  const viewportBottomEventId = resolveViewportBottomEventId({
    availableCanvasHeight: args.availableCanvasHeight,
    scrollTop: args.scrollTop,
    visibleRowPositions: args.visibleRowPositions,
    visibleRows: args.visibleRows,
  });

  return useMemo(
    () => resolveViewportContextObservability(args.scene, viewportBottomEventId),
    [args.scene, viewportBottomEventId],
  );
}

function resolveViewportContextObservability(
  scene: GraphSceneModel,
  viewportBottomEventId: string | null,
) {
  const base = scene.contextObservability;
  if (base.timelinePoints.length === 0) {
    return null;
  }

  const fallbackEventId =
    base.timelinePoints[base.timelinePoints.length - 1]?.eventId ?? null;
  return focusContextObservability({
    observability: base,
    activeEventId: viewportBottomEventId ?? fallbackEventId,
    activeSource: viewportBottomEventId ? "viewport" : "latest",
  });
}
