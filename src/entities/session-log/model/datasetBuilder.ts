import type { RunDataset } from "../../run";
import { parseRequiredTimestamp } from "../lib/helpers";
import { buildParentRunContext } from "./buildParentRunContext";
import {
  attachSummaryMetrics,
  buildCombinedTimeline,
  buildSessionLogDataset,
} from "./datasetBuilderTimeline";
import type { SnapshotTiming } from "./datasetBuilderTypes";
import type { SessionLogSnapshot } from "./types";

export function buildDatasetFromSessionLog(snapshot: SessionLogSnapshot): RunDataset | null {
  const timing = resolveSnapshotTiming(snapshot);
  if (!timing) {
    return null;
  }

  const parentRun = buildParentRunContext(snapshot, timing);
  const combinedTimeline = buildCombinedTimeline(snapshot, parentRun);
  const dataset = buildSessionLogDataset({ snapshot, timing, parentRun, combinedTimeline });
  return attachSummaryMetrics(dataset);
}

function resolveSnapshotTiming(snapshot: SessionLogSnapshot): SnapshotTiming | null {
  const startTs = parseRequiredTimestamp(snapshot.startedAt);
  const updatedAtTs = parseRequiredTimestamp(snapshot.updatedAt);
  if (startTs === null || updatedAtTs === null) {
    return null;
  }

  return {
    startTs,
    updatedTs: Math.max(updatedAtTs, startTs),
  };
}
