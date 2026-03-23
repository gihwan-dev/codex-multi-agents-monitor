import type {
  EdgeRecord,
  EventRecord,
  RunDataset,
} from "../model/types.js";
import { buildEdgeMaps, buildLaneEventMaps } from "./selectorShared.js";

const MAX_SELECTION_DEPTH = 3;
const MAX_VISITED_EVENTS = 24;

interface TraversalStep {
  eventId: string;
  depth: number;
}

export interface SelectionTraversalState {
  eventIds: Set<string>;
  edgeIds: Set<string>;
  laneIds: Set<string>;
  visited: Set<string>;
  queue: TraversalStep[];
}

export interface SelectionContext {
  eventsById: Map<string, EventRecord>;
  childEventIdsByParentId: Map<string, string[]>;
  incomingByEventId: Map<string, EdgeRecord[]>;
  outgoingByEventId: Map<string, EdgeRecord[]>;
  previousByEventId: Map<string, EventRecord>;
  nextByEventId: Map<string, EventRecord>;
}

function buildChildEventIdsByParentId(events: EventRecord[]) {
  const childEventIdsByParentId = new Map<string, string[]>();

  for (const event of events) {
    if (!event.parentId) {
      continue;
    }

    const childEventIds = childEventIdsByParentId.get(event.parentId) ?? [];
    childEventIds.push(event.eventId);
    childEventIdsByParentId.set(event.parentId, childEventIds);
  }

  return childEventIdsByParentId;
}

export function buildSelectionContext(dataset: RunDataset): SelectionContext {
  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const { previousByEventId, nextByEventId } = buildLaneEventMaps(dataset);

  return {
    eventsById: new Map(dataset.events.map((event) => [event.eventId, event])),
    childEventIdsByParentId: buildChildEventIdsByParentId(dataset.events),
    incomingByEventId,
    outgoingByEventId,
    previousByEventId,
    nextByEventId,
  };
}

export function createTraversalState(baseEventIds: string[]): SelectionTraversalState {
  return {
    eventIds: new Set(baseEventIds),
    edgeIds: new Set<string>(),
    laneIds: new Set<string>(),
    visited: new Set<string>(),
    queue: baseEventIds.map((eventId) => ({ eventId, depth: 0 })),
  };
}

function enqueueEvent(
  state: SelectionTraversalState,
  eventId: string | null | undefined,
  depth: number,
) {
  if (!eventId || state.visited.has(eventId)) {
    return;
  }

  state.queue.push({ eventId, depth });
}

function includeEdgeEndpoints(
  args: {
    state: SelectionTraversalState;
    edges: EdgeRecord[];
    nextDepth: number;
    targetKey: "sourceEventId" | "targetEventId";
  },
) {
  for (const edge of args.edges) {
    args.state.edgeIds.add(edge.edgeId);
    enqueueEvent(args.state, edge[args.targetKey], args.nextDepth);
  }
}

function includeRelatedEvents(
  args: {
    event: EventRecord;
    step: TraversalStep;
    context: SelectionContext;
    state: SelectionTraversalState;
  },
) {
  const nextDepth = args.step.depth + 1;

  enqueueEvent(
    args.state,
    args.context.previousByEventId.get(args.event.eventId)?.eventId,
    nextDepth,
  );
  enqueueEvent(
    args.state,
    args.context.nextByEventId.get(args.event.eventId)?.eventId,
    nextDepth,
  );
  enqueueEvent(args.state, args.event.parentId, nextDepth);

  for (const childEventId of args.context.childEventIdsByParentId.get(args.event.eventId) ?? []) {
    enqueueEvent(args.state, childEventId, nextDepth);
  }

  includeEdgeEndpoints({
    state: args.state,
    edges: args.context.incomingByEventId.get(args.event.eventId) ?? [],
    nextDepth,
    targetKey: "sourceEventId",
  });
  includeEdgeEndpoints({
    state: args.state,
    edges: args.context.outgoingByEventId.get(args.event.eventId) ?? [],
    nextDepth,
    targetKey: "targetEventId",
  });
}

function expandSelectionStep(
  step: TraversalStep,
  context: SelectionContext,
  state: SelectionTraversalState,
) {
  const event = resolveStepEvent(step, context, state);
  if (!event) {
    return;
  }

  state.eventIds.add(event.eventId);
  state.laneIds.add(event.laneId);
  if (step.depth < MAX_SELECTION_DEPTH) {
    includeRelatedEvents({ event, step, context, state });
  }
}

function resolveStepEvent(
  step: TraversalStep,
  context: SelectionContext,
  state: SelectionTraversalState,
) {
  if (state.visited.has(step.eventId)) {
    return null;
  }

  state.visited.add(step.eventId);
  return context.eventsById.get(step.eventId) ?? null;
}

export function expandSelectionEvents(
  context: SelectionContext,
  state: SelectionTraversalState,
) {
  while (state.queue.length > 0 && state.visited.size < MAX_VISITED_EVENTS) {
    const step = state.queue.shift();
    if (step) {
      expandSelectionStep(step, context, state);
    }
  }
}
