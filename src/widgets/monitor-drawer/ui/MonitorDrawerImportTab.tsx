import { Button, Checkbox, Textarea } from "../../../shared/ui/primitives";
import type { MonitorDrawerContentProps } from "./MonitorDrawerSections";

export function ImportTab({
  drawerState,
  onImport,
  onImportTextChange,
  onAllowRawChange,
  onNoRawChange,
}: Pick<MonitorDrawerContentProps, "drawerState" | "onImport" | "onImportTextChange" | "onAllowRawChange" | "onNoRawChange">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox aria-labelledby="monitor-drawer-raw-opt-in" checked={drawerState.allowRawImport} onCheckedChange={(checked) => onAllowRawChange(checked === true)} className="border-white/12 bg-white/[0.03]" />
        <span id="monitor-drawer-raw-opt-in">Raw opt-in</span>
      </div>
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox aria-labelledby="monitor-drawer-no-raw-storage" checked={drawerState.noRawStorage} onCheckedChange={(checked) => onNoRawChange(checked === true)} className="border-white/12 bg-white/[0.03]" />
        <span id="monitor-drawer-no-raw-storage">No raw storage</span>
      </div>
      <Textarea className="min-h-[12rem] flex-1 border-white/10 bg-white/[0.03] font-mono text-[0.78rem] text-foreground" aria-label="JSON payload to import" value={drawerState.importText} onChange={(event) => onImportTextChange(event.target.value)} />
      <Button type="button" className="w-fit" onClick={onImport}>
        Parse and import
      </Button>
    </div>
  );
}
