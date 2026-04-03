import { MonitorTopBar } from "../../../widgets/monitor-chrome";
import type { MonitorPageView } from "./monitorPageViewTypes";

interface MonitorPageHeaderProps extends MonitorPageView {
  onNavigateToSkills?: () => void;
  onNavigateToEval?: () => void;
}

export function MonitorPageHeader({
  onNavigateToSkills,
  onNavigateToEval,
  ...view
}: MonitorPageHeaderProps) {
  return (
    <MonitorTopBar
      dataset={view.chromeState?.dataset ?? null}
      followLive={view.chromeState?.followLive ?? false}
      liveConnection={view.chromeState?.liveConnection ?? "paused"}
      actionsDisabled={Boolean(view.selectionLoadState)}
      onExport={(target) => {
        view.drawerTriggerRef.current = target;
        view.actions.exportDataset(false);
      }}
      onNavigateToEval={onNavigateToEval}
      onToggleFollowLive={view.actions.toggleFollowLive}
      onToggleShortcuts={view.toggleShortcuts}
      onNavigateToSkills={onNavigateToSkills}
    />
  );
}
