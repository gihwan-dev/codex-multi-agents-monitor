import type { PromptAssembly, PromptLayerType } from "../../run";
import type { SessionLogSnapshot } from "./types";

interface PromptAssemblyOptions {
  includeRaw: boolean;
}

export function buildPromptAssembly(
  snapshot: SessionLogSnapshot,
  options: PromptAssemblyOptions,
): PromptAssembly | undefined {
  const layers = snapshot.promptAssembly;
  if (!layers || layers.length === 0) {
    return undefined;
  }

  return {
    layers: layers.map((layer, index) => ({
      layerId: `${snapshot.sessionId}:layer:${index}`,
      layerType: layer.layerType as PromptLayerType,
      label: layer.label,
      preview: layer.preview,
      contentLength: layer.contentLength,
      rawContent: options.includeRaw ? layer.rawContent : null,
    })),
    totalContentLength: layers.reduce((sum, layer) => sum + layer.contentLength, 0),
  };
}
