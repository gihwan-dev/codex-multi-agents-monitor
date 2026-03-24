import type { ReactNode } from "react";
import type { DrawerTab, RunDataset } from "../../../entities/run";
import { formatCurrency, formatTokens } from "../../../shared/lib/format";
import { NoDatasetPlaceholder } from "./MonitorDrawerTabViews";
import { resolveMonitorDrawerContent } from "./resolveMonitorDrawerContent";

export interface MonitorDrawerState {
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  allowRawImport: boolean;
  noRawStorage: boolean;
  importText: string;
  exportText: string;
}

export interface MonitorDrawerContentProps {
  drawerState: MonitorDrawerState;
  activeDataset: RunDataset | null;
  onImport: () => void;
  onImportTextChange: (value: string) => void;
  onAllowRawChange: (value: boolean) => void;
  onNoRawChange: (value: boolean) => void;
  placeholder: ReactNode;
}

export { NoDatasetPlaceholder };

export function MonitorDrawerContent({
  drawerState,
  activeDataset,
  onAllowRawChange,
  onImport,
  onImportTextChange,
  onNoRawChange,
  placeholder,
}: MonitorDrawerContentProps) {
  return resolveMonitorDrawerContent({
    drawerState,
    activeDataset,
    onAllowRawChange,
    onImport,
    onImportTextChange,
    onNoRawChange,
    placeholder,
  });
}

export function DrawerMetrics({ dataset }: { dataset: RunDataset | null }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 text-[0.8rem] tabular-nums text-muted-foreground">
      <span>{formatTokens(dataset?.run.summaryMetrics.tokens ?? 0)}</span>
      <span>{formatCurrency(dataset?.run.summaryMetrics.costUsd ?? 0)}</span>
    </div>
  );
}
