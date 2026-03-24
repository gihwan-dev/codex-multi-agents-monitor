import { MonitorInspectorRail } from "./MonitorInspectorRail";
import { MonitorMain } from "./MonitorMain";
import { MonitorRail } from "./MonitorRail";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorWorkspace(view: MonitorPageView) {
  return (
    <div className={`workspace ${view.isCompactViewport ? "workspace--stacked" : ""}`.trim()}>
      <MonitorRail {...view} />
      <MonitorMain {...view} />
      <MonitorInspectorRail {...view} />
    </div>
  );
}
