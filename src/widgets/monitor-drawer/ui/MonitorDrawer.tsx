import type { DrawerTab, RunDataset } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { MonitorDrawerPanel } from "./MonitorDrawerPanel";
import type { MonitorDrawerState } from "./MonitorDrawerSections";
import { useMonitorDrawerPresence } from "./useMonitorDrawerPresence";

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
  const { mounted, phase } = useMonitorDrawerPresence(drawerState.drawerOpen);
  if (!mounted) return <div aria-hidden="true" />;

  return (
    <div data-slot="monitor-drawer-shell" data-state={phase} aria-hidden={phase !== "open"} className={cn(phase !== "open" && "pointer-events-none")}>
      <MonitorDrawerPanel drawerState={drawerState} activeDataset={activeDataset} rawTabAvailable={rawTabAvailable} onSetDrawerTab={onSetDrawerTab} onImport={onImport} onImportTextChange={onImportTextChange} onAllowRawChange={onAllowRawChange} onNoRawChange={onNoRawChange} onCloseDrawer={onCloseDrawer} />
    </div>
  );
}
