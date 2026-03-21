import {
  DRAWER_TABS,
  type DrawerTab,
  type RunDataset,
} from "../../../entities/run";
import { formatCurrency, formatTokens } from "../../../shared/lib/format";
import { InspectorTabs, Panel } from "../../../shared/ui";
import {
  Button,
  Checkbox,
  ScrollArea,
  Textarea,
} from "../../../shared/ui/primitives";
import { PromptAssemblyView } from "../../prompt-assembly";

interface MonitorDrawerState {
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  allowRawImport: boolean;
  noRawStorage: boolean;
  importText: string;
  exportText: string;
}

interface MonitorDrawerProps {
  drawerState: MonitorDrawerState;
  activeDataset: RunDataset;
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

  const tabOptions = DRAWER_TABS.filter((tab) => rawTabAvailable || tab !== "raw").map(
    (tab) => ({
      value: tab,
      label: tab,
    }),
  );

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
        options={tabOptions}
        onValueChange={(value) => onSetDrawerTab(value as DrawerTab)}
      />

      {drawerState.drawerTab === "artifacts" ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-3 pr-3">
            {activeDataset.artifacts.length ? (
              activeDataset.artifacts.map((item) => (
                <article
                  key={item.artifactId}
                  className="grid gap-2 rounded-[12px] border border-white/8 bg-white/[0.025] px-3 py-3"
                >
                  <strong className="text-sm font-semibold">{item.title}</strong>
                  <p className="text-sm leading-6 text-muted-foreground">{item.preview}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No artifacts yet.</p>
            )}
          </div>
        </ScrollArea>
      ) : null}

      {drawerState.drawerTab === "import" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-labelledby="monitor-drawer-raw-opt-in"
              checked={drawerState.allowRawImport}
              onCheckedChange={(checked) => onAllowRawChange(checked === true)}
              className="border-white/12 bg-white/[0.03]"
            />
            <span id="monitor-drawer-raw-opt-in">Raw opt-in</span>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-labelledby="monitor-drawer-no-raw-storage"
              checked={drawerState.noRawStorage}
              onCheckedChange={(checked) => onNoRawChange(checked === true)}
              className="border-white/12 bg-white/[0.03]"
            />
            <span id="monitor-drawer-no-raw-storage">No raw storage</span>
          </div>
          <Textarea
            className="min-h-[12rem] flex-1 border-white/10 bg-white/[0.03] font-mono text-[0.78rem] text-foreground"
            aria-label="JSON payload to import"
            value={drawerState.importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
          <Button type="button" className="w-fit" onClick={onImport}>
            Parse and import
          </Button>
        </div>
      ) : null}

      {drawerState.drawerTab === "context" ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-[12px] border border-white/8 bg-white/[0.02]">
          {activeDataset.promptAssembly ? (
            <PromptAssemblyView
              assembly={activeDataset.promptAssembly}
              rawEnabled={activeDataset.run.rawIncluded}
            />
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No prompt assembly data available.
            </div>
          )}
        </div>
      ) : null}

      {drawerState.drawerTab === "raw" ? (
        <pre className="min-h-[12rem] flex-1 overflow-auto rounded-[12px] border border-white/8 bg-white/[0.03] p-3 text-[0.78rem] leading-6 font-mono text-muted-foreground">
          {activeDataset.run.rawIncluded
            ? JSON.stringify(activeDataset, null, 2)
            : "Raw payload hidden by default."}
        </pre>
      ) : null}

      {drawerState.drawerTab === "log" ? (
        <pre className="min-h-[12rem] flex-1 overflow-auto rounded-[12px] border border-white/8 bg-white/[0.03] p-3 text-[0.78rem] leading-6 font-mono text-muted-foreground">
          {drawerState.exportText || "No export generated yet."}
        </pre>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 text-[0.8rem] tabular-nums text-muted-foreground">
        <span>{formatTokens(activeDataset.run.summaryMetrics.tokens)}</span>
        <span>{formatCurrency(activeDataset.run.summaryMetrics.costUsd)}</span>
      </div>
    </Panel>
  );
}
