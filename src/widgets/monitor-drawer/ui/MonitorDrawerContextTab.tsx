import { PromptAssemblyView } from "../../prompt-assembly";
import type { MonitorDrawerContentProps } from "./MonitorDrawerSections";

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
        <PromptAssemblyView assembly={activeDataset.promptAssembly} />
      ) : (
        <div className="px-4 py-3 text-sm text-muted-foreground">No prompt assembly data available.</div>
      )}
    </div>
  );
}
