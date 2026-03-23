import type { DrawerTab, RunDataset } from "../../../entities/run";
import { InspectorTabs, Panel } from "../../../shared/ui";
import { Button } from "../../../shared/ui/primitives";
import {
  buildDrawerTabOptions,
  DrawerMetrics,
  MonitorDrawerContent,
  type MonitorDrawerState,
  NoDatasetPlaceholder,
} from "./MonitorDrawerSections";

interface MonitorDrawerProps {
  drawerState: MonitorDrawerState;
  activeDataset: RunDataset | null;
  rawTabAvailable: boolean;
  onSetDrawerTab: (tab: DrawerTab, target?: HTMLElement | null) => void;
  onImport: () => void;
  onImportTextChange: (value: string) => void;
  onAllowRawChange: (value: boolean) => void;
  onNoRawChange: (value: boolean) => void;
  onCloseDrawer: () => void;
}

export function MonitorDrawer({
  drawerState,
  activeDataset,
  rawTabAvailable,
  onSetDrawerTab,
  onImport,
  onImportTextChange,
  onAllowRawChange,
  onNoRawChange,
  onCloseDrawer,
}: MonitorDrawerProps) {
  if (!drawerState.drawerOpen) {
    return <div aria-hidden="true" />;
  }

  return (
    <Panel
      panelSlot="monitor-drawer"
      title="Bottom drawer"
      className="absolute inset-0 z-10 max-h-full overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          aria-label="Close drawer"
          onClick={onCloseDrawer}
        >
          Close
        </Button>
      }
    >
      <InspectorTabs
        value={drawerState.drawerTab}
        options={buildDrawerTabOptions(rawTabAvailable)}
        onValueChange={(value) => onSetDrawerTab(value as DrawerTab)}
      />
      <MonitorDrawerContent
        drawerState={drawerState}
        activeDataset={activeDataset}
        onImport={onImport}
        onImportTextChange={onImportTextChange}
        onAllowRawChange={onAllowRawChange}
        onNoRawChange={onNoRawChange}
        placeholder={<NoDatasetPlaceholder />}
      />
      <DrawerMetrics dataset={activeDataset} />
    </Panel>
  );
}
