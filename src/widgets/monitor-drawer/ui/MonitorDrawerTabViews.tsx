import { Button, Checkbox, ScrollArea, Textarea } from "../../../shared/ui/primitives";
import { PromptAssemblyView } from "../../prompt-assembly";
import type {
  MonitorDrawerContentProps,
  MonitorDrawerState,
} from "./MonitorDrawerSections";

export function NoDatasetPlaceholder() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
      Select a run to inspect drawer content.
    </div>
  );
}

export function ArtifactList({
  activeDataset,
  placeholder,
}: Pick<MonitorDrawerContentProps, "activeDataset" | "placeholder">) {
  if (!activeDataset) {
    return placeholder;
  }

  if (!activeDataset.artifacts.length) {
    return <p className="text-sm text-muted-foreground">No artifacts yet.</p>;
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-3 pr-3">
        {activeDataset.artifacts.map((item) => (
          <article
            key={item.artifactId}
            className="grid gap-2 rounded-[12px] border border-white/8 bg-white/[0.025] px-3 py-3"
          >
            <strong className="text-sm font-semibold">{item.title}</strong>
            <p className="text-sm leading-6 text-muted-foreground">{item.preview}</p>
          </article>
        ))}
      </div>
    </ScrollArea>
  );
}

export function ImportTab({
  drawerState,
  onImport,
  onImportTextChange,
  onAllowRawChange,
  onNoRawChange,
}: Pick<
  MonitorDrawerContentProps,
  | "drawerState"
  | "onImport"
  | "onImportTextChange"
  | "onAllowRawChange"
  | "onNoRawChange"
>) {
  return (
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
  );
}

export function ContextTab({
  activeDataset,
  placeholder,
}: Pick<MonitorDrawerContentProps, "activeDataset" | "placeholder">) {
  if (!activeDataset) {
    return placeholder;
  }

  return (
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
  );
}

export function RawTab({
  activeDataset,
}: Pick<MonitorDrawerContentProps, "activeDataset">) {
  return (
    <pre className="min-h-[12rem] flex-1 overflow-auto rounded-[12px] border border-white/8 bg-white/[0.03] p-3 font-mono text-[0.78rem] leading-6 text-muted-foreground">
      {activeDataset?.run.rawIncluded
        ? JSON.stringify(activeDataset, null, 2)
        : activeDataset
          ? "Raw payload hidden by default."
          : "Select a run to inspect drawer content."}
    </pre>
  );
}

export function LogTab({ exportText }: Pick<MonitorDrawerState, "exportText">) {
  return (
    <pre className="min-h-[12rem] flex-1 overflow-auto rounded-[12px] border border-white/8 bg-white/[0.03] p-3 font-mono text-[0.78rem] leading-6 text-muted-foreground">
      {exportText || "No export generated yet."}
    </pre>
  );
}
