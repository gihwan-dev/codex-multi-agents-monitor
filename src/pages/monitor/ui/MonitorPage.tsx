import { useEffect } from "react";
import type { RunDataset } from "../../../entities/run";
import { MonitorPageContent } from "./MonitorPageContent";
import { useMonitorPageView } from "./useMonitorPageView";

interface MonitorPageProps {
  onNavigateToSkills?: () => void;
  onNavigateToEval?: () => void;
  onDatasetsSync?: (ds: readonly RunDataset[], id: string) => void;
}

function useSyncEffect(
  datasets: readonly RunDataset[],
  activeRunId: string,
  onSync?: (ds: readonly RunDataset[], id: string) => void,
) {
  useEffect(() => { onSync?.(datasets, activeRunId); }, [datasets, activeRunId, onSync]);
}

export function MonitorPage(props: MonitorPageProps) {
  const view = useMonitorPageView();

  useSyncEffect(view.state.datasets, view.state.activeRunId, props.onDatasetsSync);

  return (
    <MonitorPageContent
      {...view}
      onNavigateToSkills={props.onNavigateToSkills}
      onNavigateToEval={props.onNavigateToEval}
    />
  );
}
