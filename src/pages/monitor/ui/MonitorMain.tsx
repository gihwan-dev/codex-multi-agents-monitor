import { MonitorDrawer } from "../../../widgets/monitor-drawer";
import { MonitorCompactInspector } from "./MonitorCompactInspector";
import { MonitorGraphChrome } from "./MonitorGraphChrome";
import { MonitorGraphContent } from "./MonitorGraphContent";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorMain(view: MonitorPageView) {
  return (
    <main
      className="workspace__main"
      aria-label="Graph canvas"
      aria-busy={Boolean(view.selectionLoadState)}
    >
      <MonitorGraphChrome {...view} />
      <MonitorGraphContent {...view} />
      <MonitorCompactInspector {...view} />
      <MonitorDrawer
        drawerState={view.drawerState}
        activeDataset={view.displayDataset}
        rawTabAvailable={view.displayRawTabAvailable}
        onSetDrawerTab={view.openDrawer}
        onImport={view.actions.importPayload}
        onImportTextChange={view.actions.setImportText}
        onAllowRawChange={view.actions.setAllowRaw}
        onNoRawChange={view.actions.setNoRawStorage}
        onCloseDrawer={view.closeDrawer}
      />
    </main>
  );
}
