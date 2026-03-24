import type { PromptAssembly, PromptLayerType } from "../../run";
import type { SessionLogSnapshot } from "./types";

interface PromptAssemblyOptions {
  includeRaw: boolean;
}

type PromptAssemblyLayerSnapshot = NonNullable<SessionLogSnapshot["promptAssembly"]>[number];

function createPromptAssemblyLayerBuilder(
  sessionId: string,
  includeRaw: boolean,
) {
  return function buildPromptAssemblyLayer(
    layer: PromptAssemblyLayerSnapshot,
    index: number,
  ) {
    return {
      layerId: `${sessionId}:layer:${index}`,
      layerType: layer.layerType as PromptLayerType,
      label: layer.label,
      preview: layer.preview,
      contentLength: layer.contentLength,
      rawContent: includeRaw ? layer.rawContent : null,
    };
  };
}

export function buildPromptAssembly(
  snapshot: SessionLogSnapshot,
  options: PromptAssemblyOptions,
): PromptAssembly | undefined {
  const layers = snapshot.promptAssembly;
  if (!layers || layers.length === 0) {
    return undefined;
  }

  const buildPromptAssemblyLayer = createPromptAssemblyLayerBuilder(
    snapshot.sessionId,
    options.includeRaw,
  );
  return {
    layers: layers.map(buildPromptAssemblyLayer),
    totalContentLength: layers.reduce((sum, layer) => sum + layer.contentLength, 0),
  };
}
