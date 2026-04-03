import {
  CausalInspectorPane,
  SessionScorePanel,
} from "../../../widgets/causal-inspector";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorCompactInspector(view: MonitorPageView) {
  if (!view.isCompactViewport) {
    return null;
  }

  return (
    <CausalInspectorPane
      compact
      summary={view.inspectorSummary}
      onSelectJump={view.actions.navigateToItem}
      onOpenDrawer={view.openDrawer}
      sessionReview={
        <SessionScorePanel
          filePath={view.activeSessionFilePath}
          onScoreSaved={view.actions.refreshSessionScoring}
          sessionTitle={view.activeDataset?.run.title ?? null}
        />
      }
    />
  );
}
