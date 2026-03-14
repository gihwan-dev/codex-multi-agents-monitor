import type { RunDataset } from "../../shared/domain/index.js";

export function buildExportPayload(dataset: RunDataset, includeRaw: boolean): string {
  const payload = {
    ...dataset,
    events: dataset.events.map((event) => ({
      ...event,
      rawInput: includeRaw ? event.rawInput : null,
      rawOutput: includeRaw ? event.rawOutput : null,
    })),
    artifacts: dataset.artifacts.map((artifact) => ({
      ...artifact,
      rawContent: includeRaw ? artifact.rawContent : null,
    })),
  };

  return JSON.stringify(payload, null, 2);
}
