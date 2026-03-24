import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
  SelectionState,
} from "../../../entities/run";
import { Panel } from "../../../shared/ui";
import { HiddenLaneNotice } from "./CausalGraphHiddenLaneNotice";
import { CausalGraphViewportSurface } from "./CausalGraphViewportSurface";
import { createEdgeSelectHandler } from "./graphEdgeSelectHandler";
import { useCausalGraphViewModel } from "./useCausalGraphViewModel";

interface CausalGraphViewProps {
  scene: GraphSceneModel;
  onSelect: (selection: SelectionState) => void;
  selectionNavigationRequestId: number;
  selectionNavigationRunId: string | null;
  runTraceId: string;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  viewportHeightOverride?: number;
  laneHeaderHeightOverride?: number;
}

export function CausalGraphView({
  scene,
  onSelect,
  selectionNavigationRequestId,
  selectionNavigationRunId,
  runTraceId,
  selectionRevealTarget,
  followLive,
  liveMode,
  onPauseFollowLive,
  viewportHeightOverride,
  laneHeaderHeightOverride,
}: CausalGraphViewProps) {
  const viewModel = useCausalGraphViewModel({
    followLive,
    laneHeaderHeightOverride,
    liveMode,
    onPauseFollowLive,
    runTraceId,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionNavigationRunId,
    selectionRevealTarget,
    scene,
    viewportHeightOverride,
  });
  const handleSelectEdge = createEdgeSelectHandler({
    followLive,
    liveMode,
    onPauseFollowLive,
    onSelect,
  });

  return (
    <Panel
      panelSlot="graph-panel"
      title="Graph"
      className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
    >
      <HiddenLaneNotice hiddenLaneCount={scene.hiddenLaneCount} />
      <CausalGraphViewportSurface
        onSelect={onSelect}
        onSelectEdge={handleSelectEdge}
        scene={scene}
        viewModel={viewModel}
      />
    </Panel>
  );
}
