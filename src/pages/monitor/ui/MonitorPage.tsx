import { useEffect } from "react";
import type { RunDataset } from "../../../entities/run";
import { MonitorPageContent } from "./MonitorPageContent";
import { useMonitorPageView } from "./useMonitorPageView";

interface MonitorPageProps {
  onNavigateToSkills?: () => void;
  onDatasetsSync?: (datasets: readonly RunDataset[], activeRunId: string) => void;
  pendingEventId?: string | null;
  onPendingEventConsumed?: () => void;
}

function useDatasetsSync(
  datasets: readonly RunDataset[],
  activeRunId: string,
  onSync?: (datasets: readonly RunDataset[], activeRunId: string) => void,
) {
  useEffect(() => {
    onSync?.(datasets, activeRunId);
  }, [datasets, activeRunId, onSync]);
}

interface PendingEventOptions {
  pendingEventId: string | null | undefined;
  events: readonly { eventId: string }[] | undefined;
  navigateToItem: (s: { kind: "event"; id: string }) => void;
  onConsumed?: () => void;
}

function applyPendingNavigation(opts: PendingEventOptions) {
  if (!opts.pendingEventId) return;
  const event = opts.events?.find((e) => e.eventId === opts.pendingEventId);
  if (event) {
    opts.navigateToItem({ kind: "event", id: event.eventId });
  }
  opts.onConsumed?.();
}

function usePendingEventNavigation(opts: PendingEventOptions) {
  const { pendingEventId, events, navigateToItem, onConsumed } = opts;
  useEffect(() => {
    applyPendingNavigation({ pendingEventId, events, navigateToItem, onConsumed });
  }, [pendingEventId, events, navigateToItem, onConsumed]);
}

export function MonitorPage(props: MonitorPageProps) {
  const view = useMonitorPageView();

  useDatasetsSync(view.state.datasets, view.state.activeRunId, props.onDatasetsSync);
  usePendingEventNavigation({
    pendingEventId: props.pendingEventId,
    events: view.activeDataset?.events,
    navigateToItem: view.actions.navigateToItem,
    onConsumed: props.onPendingEventConsumed,
  });

  return <MonitorPageContent {...view} onNavigateToSkills={props.onNavigateToSkills} />;
}
