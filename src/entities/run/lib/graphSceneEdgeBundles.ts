import type {
  EventRecord,
  GraphSceneEdgeBundle,
  GraphSceneModel,
  RunDataset,
  SelectionState,
} from "../model/types.js";

interface GraphSceneEdgeBundleArgs {
  dataset: RunDataset;
  laneIds: Set<string>;
  selection: SelectionState | null;
  selectionPathEventIds: Set<string>;
  selectionPathEdgeIds: Set<string>;
  hasMultiAgentTopology: boolean;
  visibleRowsByEventId: Map<string, string>;
}

type GraphSceneEdgeBundleSharedArgs = Pick<
  GraphSceneEdgeBundleArgs,
  | "selection"
  | "selectionPathEventIds"
  | "selectionPathEdgeIds"
  | "hasMultiAgentTopology"
  | "visibleRowsByEventId"
>;

function buildEdgeBundleKey(
  edge: RunDataset["edges"][number],
  sourceEvent: EventRecord,
  targetEvent: EventRecord,
) {
  return [
    edge.sourceEventId,
    edge.targetEventId,
    edge.edgeType,
    sourceEvent.laneId,
    targetEvent.laneId,
  ].join(":");
}

function updateEdgeBundle(
  bundle: GraphSceneEdgeBundle,
  edge: RunDataset["edges"][number],
  selection: SelectionState | null,
) {
  bundle.edgeIds.push(edge.edgeId);
  bundle.bundleCount += 1;
  bundle.selected = bundle.selected || (selection?.kind === "edge" && selection.id === edge.edgeId);
  if (!bundle.label && edge.payloadPreview) {
    bundle.label = edge.payloadPreview;
  }
}

function createEdgeBundle(
  args: {
    edge: RunDataset["edges"][number];
    sourceEvent: EventRecord;
    targetEvent: EventRecord;
    selection: SelectionState | null;
    selectionPathEventIds: Set<string>;
    selectionPathEdgeIds: Set<string>;
    hasMultiAgentTopology: boolean;
  },
) {
  return {
    id: buildEdgeBundleKey(args.edge, args.sourceEvent, args.targetEvent),
    primaryEdgeId: args.edge.edgeId,
    edgeIds: [args.edge.edgeId],
    sourceEventId: args.edge.sourceEventId,
    targetEventId: args.edge.targetEventId,
    sourceLaneId: args.sourceEvent.laneId,
    targetLaneId: args.targetEvent.laneId,
    edgeType: args.edge.edgeType,
    label: args.edge.payloadPreview ?? args.edge.edgeType,
    bundleCount: 1,
    inPath:
      args.hasMultiAgentTopology &&
      (args.selectionPathEdgeIds.has(args.edge.edgeId) ||
        (args.selectionPathEventIds.has(args.edge.sourceEventId) &&
          args.selectionPathEventIds.has(args.edge.targetEventId))),
    selected: args.selection?.kind === "edge" && args.selection.id === args.edge.edgeId,
  } satisfies GraphSceneEdgeBundle;
}

function shouldSkipEdge(
  args: {
    edge: RunDataset["edges"][number];
    sourceEvent: EventRecord | undefined;
    targetEvent: EventRecord | undefined;
    visibleRowsByEventId: Map<string, string>;
  },
) {
  return (
    !args.sourceEvent ||
    !args.targetEvent ||
    (args.edge.edgeType !== "merge" &&
      (!args.visibleRowsByEventId.has(args.edge.sourceEventId) ||
        !args.visibleRowsByEventId.has(args.edge.targetEventId)))
  );
}

function appendEdgeBundle(
  edgeBundleMap: Map<string, GraphSceneEdgeBundle>,
  args: Parameters<typeof createEdgeBundle>[0],
) {
  const bundleKey = buildEdgeBundleKey(args.edge, args.sourceEvent, args.targetEvent);
  const existingBundle = edgeBundleMap.get(bundleKey);
  if (existingBundle) {
    updateEdgeBundle(existingBundle, args.edge, args.selection);
    return;
  }

  edgeBundleMap.set(bundleKey, createEdgeBundle(args));
}

function labelEdgeBundle(bundle: GraphSceneEdgeBundle) {
  return bundle.bundleCount > 1
    ? { ...bundle, label: `${bundle.bundleCount} ${bundle.edgeType} events` }
    : bundle;
}

function buildGraphSceneEdgeBundleMap({
  dataset,
  laneIds: _laneIds,
  ...args
}: GraphSceneEdgeBundleArgs) {
  const edgeBundleMap = new Map<string, GraphSceneEdgeBundle>();
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));

  for (const edge of dataset.edges) {
    appendDatasetEdgeBundle({
      edgeBundleMap,
      eventsById,
      edge,
      shared: args,
    });
  }

  return edgeBundleMap;
}

function buildVisibleLaneEdgeBundles(
  edgeBundleMap: Map<string, GraphSceneEdgeBundle>,
  laneIds: Set<string>,
) {
  return [...edgeBundleMap.values()]
    .map(labelEdgeBundle)
    .filter((bundle) => laneIds.has(bundle.sourceLaneId) && laneIds.has(bundle.targetLaneId));
}

function appendDatasetEdgeBundle(
  args: {
    edgeBundleMap: Map<string, GraphSceneEdgeBundle>;
    eventsById: Map<string, EventRecord>;
    edge: RunDataset["edges"][number];
    shared: GraphSceneEdgeBundleSharedArgs;
  },
) {
  const sourceEvent = args.eventsById.get(args.edge.sourceEventId);
  const targetEvent = args.eventsById.get(args.edge.targetEventId);
  if (!sourceEvent || !targetEvent) {
    return;
  }

  if (
    shouldSkipEdge({
      edge: args.edge,
      sourceEvent,
      targetEvent,
      visibleRowsByEventId: args.shared.visibleRowsByEventId,
    })
  ) {
    return;
  }

  appendEdgeBundle(args.edgeBundleMap, {
    edge: args.edge,
    sourceEvent,
    targetEvent,
    selection: args.shared.selection,
    selectionPathEventIds: args.shared.selectionPathEventIds,
    selectionPathEdgeIds: args.shared.selectionPathEdgeIds,
    hasMultiAgentTopology: args.shared.hasMultiAgentTopology,
  });
}

export function buildGraphSceneEdgeBundles({
  dataset,
  laneIds,
  selection,
  selectionPathEventIds,
  selectionPathEdgeIds,
  hasMultiAgentTopology,
  visibleRowsByEventId,
}: GraphSceneEdgeBundleArgs): GraphSceneModel["edgeBundles"] {
  const edgeBundleMap = buildGraphSceneEdgeBundleMap({
    dataset,
    laneIds,
    selection,
    selectionPathEventIds,
    selectionPathEdgeIds,
    hasMultiAgentTopology,
    visibleRowsByEventId,
  });

  return buildVisibleLaneEdgeBundles(edgeBundleMap, laneIds);
}
