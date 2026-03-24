import {
  MonitorGraphToolbar,
  MonitorSummaryStrip,
} from "../../../widgets/monitor-chrome";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorGraphChrome(view: MonitorPageView) {
  if (!view.chromeState) {
    return null;
  }

  return (
    <div
      className={view.hideGraphChrome ? "pointer-events-none invisible" : undefined}
      aria-hidden={view.hideGraphChrome || undefined}
    >
      <MonitorSummaryStrip
        facts={view.chromeState.summaryFacts}
        activeFocus={view.chromeState.inspectorTitle}
      />
      <MonitorGraphToolbar
        anomalyJumps={view.chromeState.anomalyJumps}
        onJump={view.actions.navigateToItem}
      />
    </div>
  );
}
