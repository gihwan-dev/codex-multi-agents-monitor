import { useEffect } from "react";
import type { RunDataset } from "../../../entities/run";
import { MonitorPageContent } from "./MonitorPageContent";
import { useMonitorPageView } from "./useMonitorPageView";

interface MonitorPageProps {
  onNavigateToSkills?: () => void;
  onDatasetsSync?: (ds: readonly RunDataset[], id: string) => void;
  pendingEventId?: string | null;
  onPendingEventConsumed?: () => void;
}

function useSyncEffect(
  datasets: readonly RunDataset[],
  activeRunId: string,
  onSync?: (ds: readonly RunDataset[], id: string) => void,
) {
  useEffect(() => { onSync?.(datasets, activeRunId); }, [datasets, activeRunId, onSync]);
}

function usePendingNavigation(
  eventId: string | null | undefined,
  events: readonly { eventId: string }[] | undefined,
  navigate: (s: { kind: "event"; id: string }) => void,
) {
  useEffect(() => {
    if (!eventId) return;
    const found = events?.find((e) => e.eventId === eventId);
    if (found) navigate({ kind: "event", id: found.eventId });
  }, [eventId, events, navigate]);
}

export function MonitorPage(props: MonitorPageProps) {
  const view = useMonitorPageView();

  useSyncEffect(view.state.datasets, view.state.activeRunId, props.onDatasetsSync);
  usePendingNavigation(props.pendingEventId, view.activeDataset?.events, view.actions.navigateToItem);

  useEffect(() => { if (props.pendingEventId) props.onPendingEventConsumed?.(); }, [props.pendingEventId, props.onPendingEventConsumed]);

  return <MonitorPageContent {...view} onNavigateToSkills={props.onNavigateToSkills} />;
}
