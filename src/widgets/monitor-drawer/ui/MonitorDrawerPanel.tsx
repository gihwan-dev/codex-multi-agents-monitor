import type { DrawerTab, RunDataset } from "../../../entities/run";
import { InspectorTabs, Panel } from "../../../shared/ui";
import { MonitorDrawerCloseAction } from "./MonitorDrawerCloseAction";
import {
  DrawerMetrics,
  MonitorDrawerContent,
  type MonitorDrawerState,
  NoDatasetPlaceholder,
} from "./MonitorDrawerSections";
import { buildDrawerTabOptions } from "./monitorDrawerTabOptions";

interface MonitorDrawerPanelProps {
  activeDataset: RunDataset | null;
  drawerState: MonitorDrawerState;
  onAllowRawChange: (value: boolean) => void;
  onCloseDrawer: () => void;
  onImport: () => void;
  onImportTextChange: (value: string) => void;
  onNoRawChange: (value: boolean) => void;
  onSetDrawerTab: (tab: DrawerTab, target?: HTMLElement | null) => void;
  rawTabAvailable: boolean;
}

export function MonitorDrawerPanel({
  activeDataset,
  drawerState,
  onAllowRawChange,
  onCloseDrawer,
  onImport,
  onImportTextChange,
  onNoRawChange,
  onSetDrawerTab,
  rawTabAvailable,
}: MonitorDrawerPanelProps) {
  return (
    <Panel panelSlot="monitor-drawer" title="Bottom drawer" className="absolute inset-0 max-h-full overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border" actions={<MonitorDrawerCloseAction onCloseDrawer={onCloseDrawer} />}>
      <InspectorTabs value={drawerState.drawerTab} options={buildDrawerTabOptions(rawTabAvailable)} onValueChange={(value) => onSetDrawerTab(value as DrawerTab)} />
      <div key={drawerState.drawerTab} data-slot="monitor-drawer-content" className="grid min-h-0 flex-1">
        <MonitorDrawerContent drawerState={drawerState} activeDataset={activeDataset} onImport={onImport} onImportTextChange={onImportTextChange} onAllowRawChange={onAllowRawChange} onNoRawChange={onNoRawChange} placeholder={<NoDatasetPlaceholder />} />
      </div>
      <DrawerMetrics dataset={activeDataset} />
    </Panel>
  );
}
