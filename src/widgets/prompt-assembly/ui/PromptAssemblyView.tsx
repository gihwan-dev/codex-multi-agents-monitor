import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { PromptAssembly, PromptLayerType } from "../../../entities/run";
import { cn } from "../../../shared/lib";

const DYNAMIC_LAYER_TYPES: ReadonlySet<PromptLayerType> = new Set([
  "user",
  "agents",
  "collaboration-mode",
  "skills-catalog",
  "automation",
  "delegated",
]);

const HIDDEN_RAW_MESSAGE = "Raw context hidden by default.";

const LAYER_ACCENTS: Record<PromptLayerType, string> = {
  system: "var(--color-text-tertiary)",
  permissions: "var(--color-text-tertiary)",
  "app-context": "var(--color-text-tertiary)",
  "collaboration-mode": "var(--color-waiting)",
  apps: "var(--color-text-secondary)",
  "skills-catalog": "var(--color-transfer)",
  agents: "var(--color-handoff)",
  environment: "var(--color-text-tertiary)",
  automation: "var(--color-waiting)",
  delegated: "var(--color-stale)",
  user: "var(--color-active)",
  skill: "var(--color-transfer)",
  "subagent-notification": "var(--color-stale)",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 100 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}

interface PromptAssemblyViewProps {
  assembly: PromptAssembly;
  rawEnabled: boolean;
}

interface PromptLayerCardProps {
  expanded: boolean;
  onToggle: (layerId: string) => void;
  rawEnabled: boolean;
  layer: PromptAssembly["layers"][number];
}

export function PromptAssemblyView({
  assembly,
  rawEnabled,
}: PromptAssemblyViewProps) {
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

      {assembly.layers.map((layer) => (
        <PromptLayerCard
          key={layer.layerId}
          expanded={expandedIds.has(layer.layerId)}
          layer={layer}
          onToggle={toggleLayer}
          rawEnabled={rawEnabled}
        />
      ))}

      {assembly.layers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prompt assembly data available.</p>
      ) : null}
    </div>
  );
}

function PromptLayerCard({
  expanded,
  layer,
  onToggle,
  rawEnabled,
}: PromptLayerCardProps) {
  const isDynamic = DYNAMIC_LAYER_TYPES.has(layer.layerType);

  return (
    <div
      data-slot="prompt-layer"
      data-layer-id={layer.layerId}
      data-layer-type={layer.layerType}
      data-dynamic={isDynamic ? "true" : "false"}
      className={cn(
        "min-h-14 shrink-0 overflow-hidden rounded-md border",
        "border-[color:var(--color-chrome-border)] bg-[color:var(--color-prompt-layer-fill)]",
        !isDynamic && "opacity-80",
      )}
      style={buildLayerStyle(LAYER_ACCENTS[layer.layerType])}
    >
      <PromptLayerToggle expanded={expanded} layer={layer} onToggle={onToggle} />
      <PromptLayerPreview preview={layer.preview} />

      {expanded ? (
        <PromptLayerContent
          rawVisible={rawEnabled && layer.rawContent !== null}
          rawContent={layer.rawContent}
        />
      ) : null}
    </div>
  );
}

function PromptLayerToggle({
  expanded,
  layer,
  onToggle,
}: {
  expanded: boolean;
  layer: PromptAssembly["layers"][number];
  onToggle: (layerId: string) => void;
}) {
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
          "size-3 shrink-0 text-[var(--color-text-tertiary)] transition-transform",
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

function PromptLayerPreview({ preview }: { preview: string }) {
  return (
    <div
      data-slot="prompt-layer-preview"
      className="px-3 pb-3 text-xs leading-5 font-mono text-[var(--color-text-tertiary)]"
    >
      {preview}
    </div>
  );
}

function PromptLayerContent({
  rawContent,
  rawVisible,
}: {
  rawContent: string | null;
  rawVisible: boolean;
}) {
  return (
    <div
      data-slot="prompt-layer-content"
      className="max-h-96 overflow-y-auto border-t border-[color:var(--color-prompt-layer-divider)] px-3 py-3"
    >
      {rawVisible ? (
        <pre className="m-0 whitespace-pre-wrap break-words text-xs leading-6 font-mono text-muted-foreground">
          {rawContent}
        </pre>
      ) : (
        <p className="m-0 text-xs leading-6 font-mono text-muted-foreground">
          {HIDDEN_RAW_MESSAGE}
        </p>
      )}
    </div>
  );
}

function buildLayerStyle(accent: string) {
  return {
    borderLeftColor: accent,
    borderLeftWidth: "3px",
    backgroundColor: `color-mix(in srgb, ${accent} 4%, var(--color-prompt-layer-mix-base))`,
  };
}
