import { ChevronRight } from "lucide-react";
import type { PromptAssembly } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { formatBytes } from "./promptAssemblyFormat";

interface PromptLayerToggleProps {
  expanded: boolean;
  layer: PromptAssembly["layers"][number];
  onToggle: (layerId: string) => void;
}

export function PromptLayerToggle({
  expanded,
  layer,
  onToggle,
}: PromptLayerToggleProps) {
  return (
    <button
      type="button"
      data-slot="prompt-layer-toggle"
      data-layer-id={layer.layerId}
      className="flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[color:var(--color-prompt-layer-hover)]"
      onClick={() => onToggle(layer.layerId)}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${layer.label}`}
    >
      <ChevronRight
        className={cn(
          "size-3 shrink-0 text-[var(--color-text-tertiary)] transition-transform motion-reduce:transition-none",
          expanded && "rotate-90",
        )}
        aria-hidden="true"
      />
      <span
        data-slot="prompt-layer-label"
        className="flex-1 text-sm font-medium text-foreground"
      >
        {layer.label}
      </span>
      <span className="rounded bg-[var(--color-surface-raised)] px-2 py-0.5 text-[0.68rem] tabular-nums text-[var(--color-text-tertiary)]">
        {formatBytes(layer.contentLength)}
      </span>
    </button>
  );
}
