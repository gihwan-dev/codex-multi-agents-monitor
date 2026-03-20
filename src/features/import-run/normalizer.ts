import {
  calculateSummaryMetrics,
  type RawImportPayload,
  type RunDataset,
} from "../../entities/run";
import {
  buildNormalizedImportRun,
  normalizeImportArtifacts,
  normalizeImportEvents,
  resolveImportDurationMs,
} from "./normalizerHelpers.js";
import type { RedactionOptions } from "./redactor.js";

export function normalizeImportPayload(
  payload: RawImportPayload,
  options: RedactionOptions,
): RunDataset {
  const events = normalizeImportEvents(payload.events, options);
  const durationMs = resolveImportDurationMs(payload.run, events);

  const normalized: RunDataset = {
    project: payload.project,
    session: payload.session,
    run: buildNormalizedImportRun(payload.run, durationMs, options),
    lanes: payload.lanes,
    events,
    edges: payload.edges,
    artifacts: normalizeImportArtifacts(payload.artifacts, options),
  };

  return {
    ...normalized,
    run: {
      ...normalized.run,
      summaryMetrics: calculateSummaryMetrics(normalized),
    },
  };
}
