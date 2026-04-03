import type {
  EdgeRecord,
  EventRecord,
  InspectorCausalSummary,
  InspectorJump,
  RunDataset,
} from "../model/types.js";
import { buildEventFacts } from "./inspectorFactBuilders.js";

const WAITING_STATUSES = ["blocked", "waiting", "interrupted"] as const;

export interface InspectorContext {
  dataset: RunDataset;
  eventsById: Map<string, EventRecord>;
  incomingByEventId: Map<string, EdgeRecord[]>;
  outgoingByEventId: Map<string, EdgeRecord[]>;
  previousByEventId: Map<string, EventRecord>;
  buildEventJump: (
    eventId: string,
    label: string,
    description: string,
  ) => InspectorJump;
}

function buildUpstreamJumps(event: EventRecord, context: InspectorContext) {
  const upstream: InspectorJump[] = [];

  if (event.parentId) {
    upstream.push(
      context.buildEventJump(
        event.parentId,
        "Parent event",
        "Jump to the upstream event context.",
      ),
    );
  }

  for (const edge of context.incomingByEventId.get(event.eventId) ?? []) {
    upstream.push(
      context.buildEventJump(
        edge.sourceEventId,
        `${edge.edgeType} source`,
        edge.payloadPreview ?? "Jump to the upstream source event.",
      ),
    );
  }

  return upstream;
}

function buildOutgoingEdgeJumps(eventId: string, context: InspectorContext) {
  return (context.outgoingByEventId.get(eventId) ?? []).map((edge) =>
    context.buildEventJump(
      edge.targetEventId,
      `${edge.edgeType} target`,
      edge.payloadPreview ?? "Jump to the downstream target event.",
    ),
  );
}

function buildDownstreamJumps(event: EventRecord, context: InspectorContext) {
  const childEvents = context.dataset.events
    .filter((candidate) => candidate.parentId === event.eventId)
    .map((candidate) =>
      context.buildEventJump(
        candidate.eventId,
        candidate.title,
        candidate.outputPreview ?? candidate.inputPreview ?? "Jump to the downstream event.",
      ),
    );
  const downstream = [...childEvents, ...buildOutgoingEdgeJumps(event.eventId, context)];

  if (downstream.length > 0) {
    return downstream;
  }

  if (!WAITING_STATUSES.includes(event.status as (typeof WAITING_STATUSES)[number])) {
    return [];
  }

  const previous = context.previousByEventId.get(event.eventId);
  return previous ? buildOutgoingEdgeJumps(previous.eventId, context) : [];
}

function buildEventImpactSummary(
  event: EventRecord,
  downstream: InspectorJump[],
  context: InspectorContext,
) {
  const affectedEvents = downstream
    .map((jump) => context.eventsById.get(jump.selection.id))
    .filter(Boolean) as EventRecord[];
  const waitingEvents = affectedEvents.filter((item) =>
    WAITING_STATUSES.includes(item.status as (typeof WAITING_STATUSES)[number]),
  );
  const blockingEvent = waitingEvents[0];

  return {
    whyBlocked: WAITING_STATUSES.includes(event.status as (typeof WAITING_STATUSES)[number])
      ? event.waitReason ?? "reason unavailable"
      : null,
    nextAction: blockingEvent?.waitReason ?? downstream[0]?.description ?? null,
    affectedAgentCount: new Set(affectedEvents.map((item) => item.agentId)).size,
    downstreamWaitingCount: waitingEvents.length,
  };
}

function buildRawStatusLabel(event: EventRecord, rawEnabled: boolean) {
  return rawEnabled && (event.rawInput || event.rawOutput)
    ? "Raw available in drawer."
    : "Raw gated by default.";
}

export function buildEventInspectorSummary(
  event: EventRecord,
  context: InspectorContext,
  rawEnabled: boolean,
): InspectorCausalSummary {
  const upstream = buildUpstreamJumps(event, context);
  const downstream = buildDownstreamJumps(event, context);
  const impact = buildEventImpactSummary(event, downstream, context);
  const preview = event.outputPreview ?? event.inputPreview ?? "n/a";

  return {
    title: event.title,
    preview,
    facts: buildEventFacts(event),
    whyBlocked: impact.whyBlocked,
    upstream,
    downstream,
    nextAction: impact.nextAction,
    payloadPreview: preview,
    inputPreview: event.inputPreview,
    outputPreview: event.outputPreview,
    rawInput: event.rawInput,
    rawOutput: event.rawOutput,
    rawStatusLabel: buildRawStatusLabel(event, rawEnabled),
    affectedAgentCount: impact.affectedAgentCount,
    downstreamWaitingCount: impact.downstreamWaitingCount,
  };
}
