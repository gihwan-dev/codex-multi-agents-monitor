import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
  SelectionState,
} from "../../../entities/run";
import { Panel } from "../../../shared/ui";
import { HiddenLaneNotice } from "./CausalGraphHiddenLaneNotice";
import { CausalGraphViewportSurface } from "./CausalGraphViewportSurface";
import { useCausalGraphViewModel } from "./useCausalGraphViewModel";
import { useGraphInteractions } from "./useGraphInteractions";

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
  onViewportFocusEventChange?: (eventId: string | null) => void;
  viewportHeightOverride?: number;
  laneHeaderHeightOverride?: number;
}

export function CausalGraphView(props: CausalGraphViewProps) {
  const viewModel = useCausalGraphViewModel({
    followLive: props.followLive,
    laneHeaderHeightOverride: props.laneHeaderHeightOverride,
    liveMode: props.liveMode,
    onPauseFollowLive: props.onPauseFollowLive,
    runTraceId: props.runTraceId,
    selectionNavigationRunId: props.selectionNavigationRunId,
    selectionNavigationRequestId: props.selectionNavigationRequestId,
    selectionRevealTarget: props.selectionRevealTarget,
    scene: props.scene,
    viewportHeightOverride: props.viewportHeightOverride,
  });
  const handleSelectEdge = useGraphInteractions({
    followLive: props.followLive,
    liveMode: props.liveMode,
    onPauseFollowLive: props.onPauseFollowLive,
    onSelect: props.onSelect,
    onViewportFocusEventChange: props.onViewportFocusEventChange,
    visibleRows: viewModel.graphSnapshot.visibleRows,
  });

  return (
    <Panel
      panelSlot="graph-panel"
      title="Graph"
      className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
    >
      <HiddenLaneNotice hiddenLaneCount={props.scene.hiddenLaneCount} />
      <CausalGraphViewportSurface
        onSelect={props.onSelect}
        onSelectEdge={handleSelectEdge}
        scene={props.scene}
        viewModel={viewModel}
      />
    </Panel>
  );
}
