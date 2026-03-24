import type { MonitorDrawerState } from "./MonitorDrawerSections";

export function LogTab({ exportText }: Pick<MonitorDrawerState, "exportText">) {
  return (
    <pre className="min-h-[12rem] flex-1 overflow-auto rounded-[12px] border border-white/8 bg-white/[0.03] p-3 font-mono text-[0.78rem] leading-6 text-muted-foreground">
      {exportText || "No export generated yet."}
    </pre>
  );
}
