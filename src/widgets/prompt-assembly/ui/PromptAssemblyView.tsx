import { useState } from "react";
import type { PromptAssembly } from "../../../entities/run";
import { PromptLayerCard } from "./PromptLayerCard";
import { formatBytes } from "./promptAssemblyFormat";

interface PromptAssemblyViewProps {
  assembly: PromptAssembly;
  rawEnabled: boolean;
}

interface PromptAssemblyHeaderProps {
  assembly: PromptAssembly;
}

interface PromptAssemblyEmptyStateProps {
  assembly: PromptAssembly;
}


function PromptAssemblyHeader({ assembly }: PromptAssemblyHeaderProps) {
  return (
    <div
      data-slot="prompt-assembly-header"
      className="flex flex-wrap items-center justify-between gap-2"
    >
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        Prompt Context Assembly
      </span>
      <span
        data-slot="prompt-assembly-size"
        className="text-[0.72rem] tabular-nums text-[var(--color-text-tertiary)]"
      >
        {assembly.layers.length} layers · {formatBytes(assembly.totalContentLength)}
      </span>
    </div>
  );
}

function PromptAssemblyEmptyState({ assembly }: PromptAssemblyEmptyStateProps) {
  return assembly.layers.length === 0 ? (
    <p className="text-sm text-muted-foreground">No prompt assembly data available.</p>
  ) : null;
}

export function PromptAssemblyView({ assembly, rawEnabled }: PromptAssemblyViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleLayer = (layerId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  return (
    <div
      data-slot="prompt-assembly"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
    >
      <PromptAssemblyHeader assembly={assembly} />

      {assembly.layers.map((layer) => (
        <PromptLayerCard
          key={layer.layerId}
          expanded={expandedIds.has(layer.layerId)}
          layer={layer}
          onToggle={toggleLayer}
          rawEnabled={rawEnabled}
        />
      ))}

      <PromptAssemblyEmptyState assembly={assembly} />
    </div>
  );
}
