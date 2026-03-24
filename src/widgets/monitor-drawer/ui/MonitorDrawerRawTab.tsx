import type { MonitorDrawerContentProps } from "./MonitorDrawerSections";

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
