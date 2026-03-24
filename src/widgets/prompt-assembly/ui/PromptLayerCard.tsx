import type { PromptAssembly } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { PromptLayerContent } from "./PromptLayerContent";
import { PromptLayerPreview } from "./PromptLayerPreview";
import { PromptLayerToggle } from "./PromptLayerToggle";
import {
  buildLayerStyle,
  DYNAMIC_LAYER_TYPES,
  LAYER_ACCENTS,
} from "./promptLayerCardShared";

interface PromptLayerCardProps {
  expanded: boolean;
  onToggle: (layerId: string) => void;
  rawEnabled: boolean;
  layer: PromptAssembly["layers"][number];
}

export function PromptLayerCard({
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
