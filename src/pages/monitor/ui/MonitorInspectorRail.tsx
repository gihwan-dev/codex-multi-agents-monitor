import { CausalInspectorPane } from "../../../widgets/causal-inspector";
import { ResizeHandle } from "../../../widgets/monitor-chrome";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorInspectorRail(view: MonitorPageView) {
  if (view.isCompactViewport) {
    return null;
  }

  return (
    <aside
      className="workspace__inspector"
      aria-label="Inspector"
      style={{
        width: `calc(${view.state.inspectorWidth}px + var(--resize-handle-hit-width))`,
      }}
    >
      <ResizeHandle
        label="Resize inspector"
        reverse
        onDrag={view.actions.resizeInspector}
        onKeyboard={view.actions.resizeInspector}
        position={view.state.inspectorWidth}
      />
      <CausalInspectorPane
        summary={view.inspectorSummary}
        onSelectJump={view.actions.navigateToItem}
        onOpenDrawer={view.openDrawer}
        onToggleOpen={view.actions.toggleInspector}
        open={view.state.inspectorOpen}
      />
    </aside>
  );
}
