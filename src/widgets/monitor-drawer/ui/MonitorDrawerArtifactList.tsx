import { ScrollArea } from "../../../shared/ui/primitives";
import type { MonitorDrawerContentProps } from "./MonitorDrawerSections";

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
          <article key={item.artifactId} className="grid gap-2 rounded-[12px] border border-white/8 bg-white/[0.025] px-3 py-3">
            <strong className="text-sm font-semibold">{item.title}</strong>
            <p className="text-sm leading-6 text-muted-foreground">{item.preview}</p>
          </article>
        ))}
      </div>
    </ScrollArea>
  );
}
