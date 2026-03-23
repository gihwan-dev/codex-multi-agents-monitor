import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
} from "../../../entities/run";
import { useGraphViewportController } from "./graphViewportEffects";
import { buildGraphViewportSnapshot } from "./graphViewportSnapshot";
import { useGraphViewportState } from "./useGraphViewportState";

interface UseCausalGraphViewModelOptions {
  followLive: boolean;
  laneHeaderHeightOverride?: number;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  runTraceId: string;
  scene: GraphSceneModel;
  selectionNavigationRequestId: number;
  selectionNavigationRunId: string | null;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
  viewportHeightOverride?: number;
}

export function useCausalGraphViewModel({
  followLive,
  laneHeaderHeightOverride,
  liveMode,
  onPauseFollowLive,
  runTraceId,
  scene,
  selectionNavigationRequestId,
  selectionNavigationRunId,
  selectionRevealTarget,
  viewportHeightOverride,
}: UseCausalGraphViewModelOptions) {
  const viewportState = useGraphViewportState({
    laneHeaderHeightOverride,
    viewportHeightOverride,
  });
  const graphSnapshot = buildGraphViewportSnapshot({
    availableCanvasHeight: viewportState.availableCanvasHeight,
    scene,
    scrollTop: viewportState.scrollTop,
    viewportWidth: viewportState.viewportWidth,
  });
  const viewportController = useGraphViewportController({
    followLive,
    graphSnapshot,
    laneHeaderHeightOverride,
    liveMode,
    onPauseFollowLive,
    runTraceId,
    scene,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
    viewportState,
  });

  return {
    graphSnapshot,
    viewportState,
    ...viewportController,
  };
}
