import { CausalInspectorPane } from "../../../widgets/causal-inspector";
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
    />
  );
}
