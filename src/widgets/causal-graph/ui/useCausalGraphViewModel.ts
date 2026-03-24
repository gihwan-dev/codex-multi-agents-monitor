import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
} from "../../../entities/run";
import { buildGraphViewportSnapshot } from "./graphViewportSnapshot";
import { useGraphViewportController } from "./useGraphViewportController";
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

export function useCausalGraphViewModel(options: UseCausalGraphViewModelOptions) {
  const viewportState = useGraphViewportState({
    laneHeaderHeightOverride: options.laneHeaderHeightOverride,
    viewportHeightOverride: options.viewportHeightOverride,
  });
  const graphSnapshot = buildGraphViewportSnapshot({
    availableCanvasHeight: viewportState.availableCanvasHeight,
    scene: options.scene,
    scrollTop: viewportState.scrollTop,
    viewportWidth: viewportState.viewportWidth,
  });
  const viewportController = useGraphViewportController({
    followLive: options.followLive,
    graphSnapshot,
    laneHeaderHeightOverride: options.laneHeaderHeightOverride,
    liveMode: options.liveMode,
    onPauseFollowLive: options.onPauseFollowLive,
    runTraceId: options.runTraceId,
    scene: options.scene,
    selectionNavigationRunId: options.selectionNavigationRunId,
    selectionNavigationRequestId: options.selectionNavigationRequestId,
    selectionRevealTarget: options.selectionRevealTarget,
    viewportState,
  });

  return {
    graphSnapshot,
    viewportState,
    ...viewportController,
  };
}
