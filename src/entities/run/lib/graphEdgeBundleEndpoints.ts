import type { EventRecord, RunDataset } from "../model/types.js";

interface ResolveEdgeBundleEndpointsArgs {
  edge: RunDataset["edges"][number];
  eventsById: Map<string, EventRecord>;
  laneNameById: Map<string, string>;
}

export function resolveEdgeBundleEndpoints(args: ResolveEdgeBundleEndpointsArgs) {
  const sourceEvent = args.eventsById.get(args.edge.sourceEventId);
  const targetEvent = args.eventsById.get(args.edge.targetEventId);
  if (!sourceEvent || !targetEvent) {
    return null;
  }

  return {
    sourceEvent,
    targetEvent,
    sourceLaneName: args.laneNameById.get(sourceEvent.laneId) ?? "",
    targetLaneName: args.laneNameById.get(targetEvent.laneId) ?? "",
  };
}
