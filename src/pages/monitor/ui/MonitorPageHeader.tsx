import { MonitorTopBar } from "../../../widgets/monitor-chrome";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorPageHeader(view: MonitorPageView) {
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
      onToggleFollowLive={view.actions.toggleFollowLive}
      onToggleShortcuts={view.toggleShortcuts}
    />
  );
}
