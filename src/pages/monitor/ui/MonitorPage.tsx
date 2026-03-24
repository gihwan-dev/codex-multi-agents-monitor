import { MonitorPageContent } from "./MonitorPageContent";
import { useMonitorPageView } from "./useMonitorPageView";

export function MonitorPage() {
  const view = useMonitorPageView();
  return <MonitorPageContent {...view} />;
}
