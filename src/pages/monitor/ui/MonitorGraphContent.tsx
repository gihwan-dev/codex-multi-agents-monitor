import { CausalGraphView } from "../../../widgets/causal-graph";
import { MonitorEmptyGraphState } from "./MonitorEmptyGraphState";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorGraphContent(view: MonitorPageView) {
  if (!view.displayDataset) {
    return (
      <MonitorEmptyGraphState
        selectionLoadingPresentation={view.selectionLoadingPresentation}
      />
    );
  }

  return (
    <CausalGraphView
      scene={view.graphScene}
      onSelect={view.actions.selectItem}
      onViewportFocusEventChange={view.setViewportFocusEventId}
      selectionNavigationRequestId={view.state.selectionNavigationRequestId}
      selectionNavigationRunId={view.state.selectionNavigationRunId}
      runTraceId={view.displayDataset.run.traceId}
      selectionRevealTarget={view.selectionRevealTarget}
      followLive={view.activeFollowLive}
      liveMode={view.displayDataset.run.liveMode}
      onPauseFollowLive={view.actions.pauseFollowLive}
    />
  );
}
