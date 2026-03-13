import type { CanonicalEvent, EventKind } from "@/shared/canonical";
import type { SessionDetailSnapshot, TimelineLineageRelation } from "@/shared/queries";

import type {
  TimelineActivationSegment,
  TimelineConnector,
  TimelineConnectorKind,
  TimelineItemKind,
  TimelineItemView,
  TimelineLaneColumn,
  TimelineLaneView,
  TimelineProjection,
  TimelineRelationMap,
  TimelineSelection,
  TimelineSelectionContext,
  TimelineTurnBand,
} from "./types";
import {
  parseTimelineTimestamp,
  resolveTimelineSource,
  timelineEventOrder,
  timelineMetaString,
} from "./source";

const LANE_ACCENTS: Record<TimelineLaneColumn, string> = {
  main: "from-emerald-300/78 via-emerald-200/62 to-emerald-100/36",
  other: "from-sky-300/74 via-cyan-200/58 to-sky-100/34",
  user: "from-amber-300/76 via-amber-200/58 to-amber-100/34",
};

type LaneSeed = {
  earliestAtMs: number;
  events: CanonicalEvent[];
  laneId: string;
  ownerSessionId: string | null;
};

function isResolvedLineageRelation(
  relation: TimelineLineageRelation,
): relation is TimelineLineageRelation & { child_session_id: string; state: "resolved" } {
  return relation.state === "resolved" && typeof relation.child_session_id === "string";
}

function formatRoleLabel(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function itemOrder(left: TimelineItemView, right: TimelineItemView) {
  return (
    left.startedAtMs - right.startedAtMs ||
    itemEndedAtMs(left) - itemEndedAtMs(right) ||
    left.itemId.localeCompare(right.itemId)
  );
}

function laneLabel(seed: LaneSeed, rootSessionId: string) {
  if (
    seed.ownerSessionId === rootSessionId &&
    seed.events.some((event) => event.kind !== "user_message")
  ) {
    return "Main";
  }

  for (const event of seed.events) {
    const nickname = timelineMetaString(event, "agent_nickname");
    if (nickname) {
      return nickname;
    }
  }

  for (const event of seed.events) {
    const role = timelineMetaString(event, "agent_role");
    if (role) {
      return formatRoleLabel(role);
    }
  }

  if (seed.laneId === "user") {
    return "User";
  }

  return seed.laneId
    .replace(/^agent:/, "")
    .replace(/[-_:]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isMainLane(seed: LaneSeed, rootSessionId: string) {
  if (
    seed.ownerSessionId === rootSessionId &&
    seed.events.some((event) => event.kind !== "user_message")
  ) {
    return true;
  }

  if (seed.laneId === "main" || seed.laneId === "agent:main") {
    return true;
  }

  return seed.events.some(
    (event) => event.session_id === seed.ownerSessionId && timelineMetaString(event, "agent_role") === "main",
  );
}

function itemKindForEvent(event: CanonicalEvent): TimelineItemKind {
  switch (event.kind) {
    case "agent_message":
    case "user_message":
      return "message";
    case "reasoning":
      return "reasoning";
    case "tool_call":
    case "tool_output":
    case "tool_span":
      return "tool";
    case "token_delta":
      return "token";
    case "turn_aborted":
    case "error":
      return "error";
    default:
      return "status";
  }
}

function itemLabelForEvent(event: CanonicalEvent) {
  if (event.kind === "user_message") {
    return "User prompt";
  }

  if (event.kind === "reasoning") {
    return "Reasoning";
  }

  if (event.kind === "token_delta") {
    return "Token snapshot";
  }

  return event.summary ?? event.kind.split("_").join(" ");
}

function buildSimpleItem(event: CanonicalEvent): TimelineItemView {
  const startedAtMs = parseTimelineTimestamp(event.occurred_at) ?? 0;
  const endedAtMs = event.duration_ms ? startedAtMs + event.duration_ms : null;

  return {
    detailLevel: event.detail_level,
    endedAt: endedAtMs ? new Date(endedAtMs).toISOString() : null,
    endedAtMs,
    inputPreview: event.kind === "tool_call" ? event.payload_preview : null,
    itemId: event.event_id,
    kind: itemKindForEvent(event),
    label: itemLabelForEvent(event),
    laneId: event.lane_id,
    meta: event.meta,
    ownerSessionId: event.session_id,
    outputPreview: event.kind === "tool_output" ? event.payload_preview : null,
    payloadPreview: event.payload_preview,
    sourceEvents: [event],
    startedAt: event.occurred_at,
    startedAtMs,
    summary: event.summary,
    tokenInput: event.token_input ?? 0,
    tokenOutput: event.token_output ?? 0,
  };
}

function buildMergedToolItem(callEvent: CanonicalEvent, outputEvent: CanonicalEvent) {
  const startedAtMs = parseTimelineTimestamp(callEvent.occurred_at) ?? 0;
  const endedAtMs =
    parseTimelineTimestamp(outputEvent.occurred_at) ??
    (callEvent.duration_ms ? startedAtMs + callEvent.duration_ms : null);

  return {
    detailLevel:
      outputEvent.detail_level === "raw" || callEvent.detail_level === "raw"
        ? "raw"
        : "diagnostic",
    endedAt: outputEvent.occurred_at,
    endedAtMs,
    inputPreview: callEvent.payload_preview,
    itemId: `tool:${timelineMetaString(callEvent, "call_id") ?? callEvent.event_id}`,
    kind: "tool",
    label: callEvent.summary ?? "Tool",
    laneId: callEvent.lane_id,
    meta: {
      ...callEvent.meta,
      ...outputEvent.meta,
      linked_spawn_session_id:
        timelineMetaString(outputEvent, "spawned_session_id") ??
        timelineMetaString(callEvent, "spawned_session_id"),
      merged_tool_output: outputEvent.event_id,
    },
    ownerSessionId: callEvent.session_id,
    outputPreview: outputEvent.payload_preview,
    payloadPreview: callEvent.payload_preview,
    sourceEvents: [callEvent, outputEvent],
    startedAt: callEvent.occurred_at,
    startedAtMs,
    summary: outputEvent.summary ?? callEvent.summary,
    tokenInput: (callEvent.token_input ?? 0) + (outputEvent.token_input ?? 0),
    tokenOutput: (callEvent.token_output ?? 0) + (outputEvent.token_output ?? 0),
  } satisfies TimelineItemView;
}

function shouldRenderEvent(event: CanonicalEvent) {
  return event.kind !== "token_delta";
}

function buildItems(events: CanonicalEvent[]) {
  const orderedEvents = [...events].sort(timelineEventOrder);
  const pendingToolCalls = new Map<string, CanonicalEvent>();
  const items: TimelineItemView[] = [];

  for (const event of orderedEvents) {
    const callId = timelineMetaString(event, "call_id");

    if (event.kind === "tool_call" && callId) {
      pendingToolCalls.set(callId, event);
      continue;
    }

    if (event.kind === "tool_output" && callId) {
      const callEvent = pendingToolCalls.get(callId);
      if (callEvent) {
        pendingToolCalls.delete(callId);
        items.push(buildMergedToolItem(callEvent, event));
        continue;
      }
    }

    if (shouldRenderEvent(event)) {
      items.push(buildSimpleItem(event));
    }
  }

  for (const event of pendingToolCalls.values()) {
    items.push(buildSimpleItem(event));
  }

  return items.sort(itemOrder);
}

function laneOwnerSessionId(events: CanonicalEvent[]) {
  return events.find((event) => event.kind !== "user_message")?.session_id ?? events[0]?.session_id ?? null;
}

function buildLanes(events: CanonicalEvent[], rootSessionId: string) {
  const laneSeeds = new Map<string, LaneSeed>();

  for (const event of events) {
    const key = event.lane_id;
    const occurredAtMs = parseTimelineTimestamp(event.occurred_at) ?? 0;
    const existing = laneSeeds.get(key);

    if (existing) {
      existing.events.push(event);
      existing.earliestAtMs = Math.min(existing.earliestAtMs, occurredAtMs);
      existing.ownerSessionId = existing.ownerSessionId ?? event.session_id;
      continue;
    }

    laneSeeds.set(key, {
      earliestAtMs: occurredAtMs,
      events: [event],
      laneId: key,
      ownerSessionId: event.session_id,
    });
  }

  const ordered = [...laneSeeds.values()].sort((left, right) => {
    if (left.laneId === "user") {
      return -1;
    }
    if (right.laneId === "user") {
      return 1;
    }

    const leftMain = isMainLane(
      { ...left, ownerSessionId: left.ownerSessionId ?? laneOwnerSessionId(left.events) },
      rootSessionId,
    );
    const rightMain = isMainLane(
      { ...right, ownerSessionId: right.ownerSessionId ?? laneOwnerSessionId(right.events) },
      rootSessionId,
    );
    if (leftMain && !rightMain) {
      return -1;
    }
    if (!leftMain && rightMain) {
      return 1;
    }

    return left.earliestAtMs - right.earliestAtMs || left.laneId.localeCompare(right.laneId);
  });

  const mainLaneId =
    ordered.find((seed) =>
      seed.events.some(
        (event) => event.session_id === rootSessionId && timelineMetaString(event, "agent_role") === "main",
      ),
    )?.laneId ??
    ordered.find((seed) => isMainLane(seed, rootSessionId))?.laneId ??
    null;

  return ordered.map((seed) => {
    const column: TimelineLaneColumn =
      seed.laneId === "user" ? "user" : seed.laneId === mainLaneId ? "main" : "other";

    return {
      accentClass: LANE_ACCENTS[column],
      column,
      label: laneLabel(seed, rootSessionId),
      laneId: seed.laneId,
      ownerSessionId: seed.ownerSessionId,
    } satisfies TimelineLaneView;
  });
}

function itemEndedAtMs(item: TimelineItemView) {
  return item.endedAtMs ?? item.startedAtMs;
}

function itemTerminalEventKind(item: TimelineItemView): EventKind {
  return item.sourceEvents[item.sourceEvents.length - 1]?.kind ?? "agent_message";
}

function isUserPromptItem(item: TimelineItemView) {
  return item.sourceEvents.some((event) => event.kind === "user_message");
}

function userPromptSummary(item: TimelineItemView) {
  return item.summary ?? item.payloadPreview ?? "User prompt";
}

function buildTurnBands(items: TimelineItemView[], rootSessionId: string) {
  if (items.length === 0) {
    return [];
  }

  const orderedItems = [...items].sort(itemOrder);
  const promptItems = orderedItems.filter(
    (item) => item.ownerSessionId === rootSessionId && isUserPromptItem(item),
  );
  const turnBands: TimelineTurnBand[] = [];
  let cursor = 0;

  const takeItemsUntil = (limitExclusive: number) => {
    const bucket: TimelineItemView[] = [];
    while (cursor < orderedItems.length && orderedItems[cursor].startedAtMs < limitExclusive) {
      bucket.push(orderedItems[cursor]);
      cursor += 1;
    }
    return bucket;
  };

  if (promptItems.length === 0) {
    return [
      {
        endedAtMs: Math.max(...orderedItems.map(itemEndedAtMs)),
        itemIds: orderedItems.map((item) => item.itemId),
        label: "Turn 1",
        startedAtMs: orderedItems[0].startedAtMs,
        summary: orderedItems[0].summary ?? orderedItems[0].label,
        turnBandId: "turn:1",
        turnIndex: 1,
        userItemId: null,
      },
    ];
  }

  const firstPrompt = promptItems[0];
  const preludeItems = takeItemsUntil(firstPrompt.startedAtMs);
  if (preludeItems.length > 0) {
    turnBands.push({
      endedAtMs: Math.max(...preludeItems.map(itemEndedAtMs)),
      itemIds: preludeItems.map((item) => item.itemId),
      label: "Context",
      startedAtMs: preludeItems[0].startedAtMs,
      summary: preludeItems[0].summary ?? "Session setup",
      turnBandId: "turn:context",
      turnIndex: 0,
      userItemId: null,
    });
  }

  for (const [index, promptItem] of promptItems.entries()) {
    const nextPrompt = promptItems[index + 1];
    const bandItems = takeItemsUntil(nextPrompt?.startedAtMs ?? Number.POSITIVE_INFINITY);
    if (bandItems.length === 0) {
      continue;
    }

    const turnIndex = index + 1;
    turnBands.push({
      endedAtMs: Math.max(...bandItems.map(itemEndedAtMs)),
      itemIds: bandItems.map((item) => item.itemId),
      label: `Turn ${turnIndex}`,
      startedAtMs: promptItem.startedAtMs,
      summary: userPromptSummary(promptItem),
      turnBandId: `turn:${turnIndex}`,
      turnIndex,
      userItemId: promptItem.itemId,
    });
  }

  return turnBands;
}

function buildActivationSegments(turnBands: TimelineTurnBand[], itemsById: Record<string, TimelineItemView>) {
  const activationSegments: TimelineActivationSegment[] = [];

  for (const turnBand of turnBands) {
    const bandItems = turnBand.itemIds
      .map((itemId) => itemsById[itemId])
      .filter((item): item is TimelineItemView => Boolean(item))
      .sort(itemOrder);

    if (bandItems.length === 0) {
      continue;
    }

    let current: TimelineItemView[] = [];

    const flushSegment = () => {
      if (current.length === 0) {
        return;
      }

      const first = current[0];
      const last = current[current.length - 1];
      const nextIndex = activationSegments.filter(
        (segment) => segment.turnBandId === turnBand.turnBandId,
      ).length;
      activationSegments.push({
        anchorItemId: last.itemId,
        endedAtMs: itemEndedAtMs(last),
        itemIds: current.map((item) => item.itemId),
        laneId: first.laneId,
        ownerSessionId: first.ownerSessionId,
        segmentId: `segment:${turnBand.turnBandId}:${nextIndex}`,
        startedAtMs: first.startedAtMs,
        terminalEventKind: itemTerminalEventKind(last),
        terminalItemId: last.itemId,
        turnBandId: turnBand.turnBandId,
      });
      current = [];
    };

    for (const item of bandItems) {
      if (current.length === 0 || current[0].laneId === item.laneId) {
        current.push(item);
        continue;
      }

      flushSegment();
      current.push(item);
    }

    flushSegment();
  }

  return activationSegments;
}

function connectorKindForSegments(
  source: TimelineActivationSegment,
  target: TimelineActivationSegment,
  lanesById: Record<string, TimelineLaneView>,
): TimelineConnectorKind {
  const sourceLane = lanesById[source.laneId];
  const targetLane = lanesById[target.laneId];

  if (source.terminalEventKind === "spawn" && source.laneId !== target.laneId) {
    return "spawn";
  }

  if (
    (source.terminalEventKind === "agent_complete" || source.terminalEventKind === "turn_aborted") &&
    (targetLane?.column === "main" || targetLane?.column === "user")
  ) {
    return "complete";
  }

  if (sourceLane?.column === "other" && targetLane?.column === "main") {
    return "reply";
  }

  return "handoff";
}

function firstSegmentForSession(
  activationSegments: TimelineActivationSegment[],
  sessionId: string,
) {
  return activationSegments
    .filter((segment) => segment.ownerSessionId === sessionId)
    .sort(
      (left, right) =>
        left.startedAtMs - right.startedAtMs ||
        left.endedAtMs - right.endedAtMs ||
        left.segmentId.localeCompare(right.segmentId),
    )[0] ?? null;
}

function lastSegmentForSession(
  activationSegments: TimelineActivationSegment[],
  sessionId: string,
) {
  return activationSegments
    .filter((segment) => segment.ownerSessionId === sessionId)
    .sort(
      (left, right) =>
        right.endedAtMs - left.endedAtMs ||
        right.startedAtMs - left.startedAtMs ||
        right.segmentId.localeCompare(left.segmentId),
    )[0] ?? null;
}

function segmentForItemId(
  activationSegments: TimelineActivationSegment[],
  itemId: string | null,
) {
  if (!itemId) {
    return null;
  }

  return activationSegments.find((segment) => segment.itemIds.includes(itemId)) ?? null;
}

function latestParentSegmentBefore(
  activationSegments: TimelineActivationSegment[],
  sessionId: string,
  limitMs: number,
) {
  return activationSegments
    .filter(
      (segment) => segment.ownerSessionId === sessionId && segment.startedAtMs <= limitMs,
    )
    .sort(
      (left, right) =>
        right.endedAtMs - left.endedAtMs ||
        right.startedAtMs - left.startedAtMs ||
        right.segmentId.localeCompare(left.segmentId),
    )[0] ?? null;
}

function firstParentSegmentAfter(
  activationSegments: TimelineActivationSegment[],
  sessionId: string,
  startAfterMs: number,
) {
  return activationSegments
    .filter(
      (segment) => segment.ownerSessionId === sessionId && segment.startedAtMs >= startAfterMs,
    )
    .sort(
      (left, right) =>
        left.startedAtMs - right.startedAtMs ||
        left.endedAtMs - right.endedAtMs ||
        left.segmentId.localeCompare(right.segmentId),
    )[0] ?? null;
}

function buildExplicitLineageConnectors(
  relations: TimelineLineageRelation[],
  activationSegments: TimelineActivationSegment[],
  itemsById: Record<string, TimelineItemView>,
) {
  const connectors: TimelineConnector[] = [];

  for (const relation of relations.filter(isResolvedLineageRelation)) {
    const targetSegment = firstSegmentForSession(activationSegments, relation.child_session_id);
    if (!targetSegment) {
      continue;
    }

    const sourceSegment =
      segmentForItemId(activationSegments, relation.spawn_event_id ?? null) ??
      latestParentSegmentBefore(
        activationSegments,
        relation.parent_session_id,
        targetSegment.startedAtMs,
      );

    if (sourceSegment && sourceSegment.laneId !== targetSegment.laneId) {
      connectors.push({
        anchorItemId: sourceSegment.anchorItemId,
        connectorId: `connector:${relation.relation_id}:spawn`,
        endedAtMs: targetSegment.startedAtMs,
        kind: "spawn",
        sourceLaneId: sourceSegment.laneId,
        sourceSegmentId: sourceSegment.segmentId,
        startedAtMs: sourceSegment.endedAtMs,
        targetAnchorItemId: targetSegment.anchorItemId,
        targetLaneId: targetSegment.laneId,
        targetSegmentId: targetSegment.segmentId,
        turnBandId: targetSegment.turnBandId,
      });
    }

    const childTerminalSegment = lastSegmentForSession(activationSegments, relation.child_session_id);
    if (!childTerminalSegment) {
      continue;
    }

    const childTerminalItem = itemsById[childTerminalSegment.terminalItemId];
    const isCompleteTerminal =
      childTerminalItem?.sourceEvents.some(
        (event) => event.kind === "agent_complete" || event.kind === "turn_aborted",
      ) ?? false;
    if (!isCompleteTerminal) {
      continue;
    }

    const resumedParentSegment = firstParentSegmentAfter(
      activationSegments,
      relation.parent_session_id,
      childTerminalSegment.endedAtMs,
    );
    if (!resumedParentSegment || resumedParentSegment.laneId === childTerminalSegment.laneId) {
      continue;
    }

    connectors.push({
      anchorItemId: childTerminalSegment.anchorItemId,
      connectorId: `connector:${relation.relation_id}:complete`,
      endedAtMs: resumedParentSegment.startedAtMs,
      kind: "complete",
      sourceLaneId: childTerminalSegment.laneId,
      sourceSegmentId: childTerminalSegment.segmentId,
      startedAtMs: childTerminalSegment.endedAtMs,
      targetAnchorItemId: resumedParentSegment.anchorItemId,
      targetLaneId: resumedParentSegment.laneId,
      targetSegmentId: resumedParentSegment.segmentId,
      turnBandId: resumedParentSegment.turnBandId,
    });
  }

  return connectors;
}

function buildConnectors(
  turnBands: TimelineTurnBand[],
  activationSegments: TimelineActivationSegment[],
  lanesById: Record<string, TimelineLaneView>,
  lineageRelations: TimelineLineageRelation[],
  itemsById: Record<string, TimelineItemView>,
) {
  const segmentsById = Object.fromEntries(
    activationSegments.map((segment) => [segment.segmentId, segment]),
  ) as Record<string, TimelineActivationSegment>;
  const segmentIdsByTurn = turnBands.reduce<Record<string, string[]>>((accumulator, turnBand) => {
    accumulator[turnBand.turnBandId] = activationSegments
      .filter((segment) => segment.turnBandId === turnBand.turnBandId)
      .sort(
        (left, right) =>
          left.startedAtMs - right.startedAtMs ||
          left.endedAtMs - right.endedAtMs ||
          left.segmentId.localeCompare(right.segmentId),
      )
      .map((segment) => segment.segmentId);
    return accumulator;
  }, {});

  const connectors = buildExplicitLineageConnectors(
    lineageRelations,
    activationSegments,
    itemsById,
  );
  const resolvedRelations = lineageRelations.filter(isResolvedLineageRelation);
  const relatedSessionPairs = new Set(
    resolvedRelations.flatMap((relation) => [
      `${relation.parent_session_id}:${relation.child_session_id}`,
      `${relation.child_session_id}:${relation.parent_session_id}`,
    ]),
  );
  const existingPairs = new Set(
    connectors.map((connector) => `${connector.sourceSegmentId}:${connector.targetSegmentId}`),
  );

  for (const turnBand of turnBands) {
    const segmentIds = segmentIdsByTurn[turnBand.turnBandId] ?? [];

    for (let index = 0; index < segmentIds.length - 1; index += 1) {
      const source = segmentsById[segmentIds[index]];
      const target = segmentsById[segmentIds[index + 1]];

      if (!source || !target || source.laneId === target.laneId) {
        continue;
      }

      if (
        source.ownerSessionId !== target.ownerSessionId &&
        relatedSessionPairs.has(`${source.ownerSessionId}:${target.ownerSessionId}`)
      ) {
        continue;
      }

      const pairKey = `${source.segmentId}:${target.segmentId}`;
      if (existingPairs.has(pairKey)) {
        continue;
      }

      connectors.push({
        anchorItemId: source.anchorItemId,
        connectorId: `connector:${turnBand.turnBandId}:${connectors.length}`,
        endedAtMs: target.startedAtMs,
        kind: connectorKindForSegments(source, target, lanesById),
        sourceLaneId: source.laneId,
        sourceSegmentId: source.segmentId,
        startedAtMs: source.endedAtMs,
        targetAnchorItemId: target.anchorItemId,
        targetLaneId: target.laneId,
        targetSegmentId: target.segmentId,
        turnBandId: turnBand.turnBandId,
      });
      existingPairs.add(pairKey);
    }
  }

  return connectors;
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function buildRelationMap(
  items: TimelineItemView[],
  turnBands: TimelineTurnBand[],
  activationSegments: TimelineActivationSegment[],
  connectors: TimelineConnector[],
) {
  const relationMap: TimelineRelationMap = {
    connectors: {},
    items: Object.fromEntries(
      items.map((item) => [item.itemId, { connectorIds: [], segmentId: null, turnBandId: null }]),
    ),
    segments: {},
    turns: {},
  };

  for (const turnBand of turnBands) {
    relationMap.turns[turnBand.turnBandId] = {
      connectorIds: [],
      itemIds: [...turnBand.itemIds],
      segmentIds: [],
    };

    for (const itemId of turnBand.itemIds) {
      relationMap.items[itemId] = relationMap.items[itemId] ?? {
        connectorIds: [],
        segmentId: null,
        turnBandId: null,
      };
      relationMap.items[itemId].turnBandId = turnBand.turnBandId;
    }
  }

  for (const segment of activationSegments) {
    relationMap.segments[segment.segmentId] = {
      connectorIds: [],
      itemIds: [...segment.itemIds],
      turnBandId: segment.turnBandId,
    };
    pushUnique(relationMap.turns[segment.turnBandId]?.segmentIds ?? [], segment.segmentId);

    for (const itemId of segment.itemIds) {
      relationMap.items[itemId] = relationMap.items[itemId] ?? {
        connectorIds: [],
        segmentId: null,
        turnBandId: segment.turnBandId,
      };
      relationMap.items[itemId].segmentId = segment.segmentId;
      relationMap.items[itemId].turnBandId = segment.turnBandId;
    }
  }

  const segmentsById = Object.fromEntries(
    activationSegments.map((segment) => [segment.segmentId, segment]),
  ) as Record<string, TimelineActivationSegment>;

  for (const connector of connectors) {
    const sourceSegment = segmentsById[connector.sourceSegmentId];
    const targetSegment = segmentsById[connector.targetSegmentId];
    const relatedItemIds = Array.from(
      new Set([...(sourceSegment?.itemIds ?? []), ...(targetSegment?.itemIds ?? [])]),
    );

    relationMap.connectors[connector.connectorId] = {
      itemIds: relatedItemIds,
      segmentIds: [connector.sourceSegmentId, connector.targetSegmentId],
      turnBandId: connector.turnBandId,
    };

    pushUnique(relationMap.turns[connector.turnBandId]?.connectorIds ?? [], connector.connectorId);
    pushUnique(
      relationMap.segments[connector.sourceSegmentId]?.connectorIds ?? [],
      connector.connectorId,
    );
    pushUnique(
      relationMap.segments[connector.targetSegmentId]?.connectorIds ?? [],
      connector.connectorId,
    );

    for (const itemId of relatedItemIds) {
      relationMap.items[itemId] = relationMap.items[itemId] ?? {
        connectorIds: [],
        segmentId: null,
        turnBandId: connector.turnBandId,
      };
      pushUnique(relationMap.items[itemId].connectorIds, connector.connectorId);
    }
  }

  return relationMap;
}

function emptySelectionContext(): TimelineSelectionContext {
  return {
    anchorItemId: null,
    relatedConnectorIds: [],
    relatedItemIds: [],
    relatedSegmentIds: [],
    selectedConnector: null,
    selectedItem: null,
    selectedSegment: null,
    selectedTurnBand: null,
  };
}

function selectionScope(projection: TimelineProjection, turnBandId: string | null) {
  if (!turnBandId) {
    return {
      relatedConnectorIds: [],
      relatedItemIds: [],
      relatedSegmentIds: [],
      selectedTurnBand: null,
    };
  }

  const turn = projection.relationMap.turns[turnBandId];
  return {
    relatedConnectorIds: turn?.connectorIds ?? [],
    relatedItemIds: turn?.itemIds ?? [],
    relatedSegmentIds: turn?.segmentIds ?? [],
    selectedTurnBand: projection.turnBandsById[turnBandId] ?? null,
  };
}

export function buildTimelineProjection(
  detail: SessionDetailSnapshot | null,
): TimelineProjection | null {
  if (!detail) {
    return null;
  }

  const timelineSource = resolveTimelineSource(detail);
  const events = timelineSource.events;
  const items = buildItems(events);
  const itemsById = Object.fromEntries(items.map((item) => [item.itemId, item])) as Record<
    string,
    TimelineItemView
  >;
  const lanes = buildLanes(events, timelineSource.rootSessionId);
  const lanesById = Object.fromEntries(lanes.map((lane) => [lane.laneId, lane])) as Record<
    string,
    TimelineLaneView
  >;
  const startedAtMs =
    parseTimelineTimestamp(detail.bundle.session.started_at) ??
    items[0]?.startedAtMs ??
    Date.now();
  const latestItem = items[items.length - 1] ?? null;
  const latestAtMs =
    latestItem?.endedAtMs ??
    latestItem?.startedAtMs ??
    parseTimelineTimestamp(detail.last_event_at) ??
    startedAtMs;
  const turnBands = buildTurnBands(items, timelineSource.rootSessionId);
  const turnBandsById = Object.fromEntries(
    turnBands.map((turnBand) => [turnBand.turnBandId, turnBand]),
  ) as Record<string, TimelineTurnBand>;
  const activationSegments = buildActivationSegments(turnBands, itemsById);
  const segmentsById = Object.fromEntries(
    activationSegments.map((segment) => [segment.segmentId, segment]),
  ) as Record<string, TimelineActivationSegment>;
  const connectors = buildConnectors(
    turnBands,
    activationSegments,
    lanesById,
    timelineSource.lineageRelations,
    itemsById,
  );
  const connectorsById = Object.fromEntries(
    connectors.map((connector) => [connector.connectorId, connector]),
  ) as Record<string, TimelineConnector>;
  const relationMap = buildRelationMap(items, turnBands, activationSegments, connectors);
  const sessionTokenTotals = events.reduce(
    (totals, event) => ({
      input: totals.input + (event.token_input ?? 0),
      output: totals.output + (event.token_output ?? 0),
    }),
    { input: 0, output: 0 },
  );

  return {
    activationSegments,
    connectors,
    connectorsById,
    detail,
    items,
    itemsById,
    lanes,
    lineageRelations: timelineSource.lineageRelations,
    latestItemId: latestItem?.itemId ?? null,
    metrics: detail.bundle.metrics ?? [],
    relationMap,
    rootSessionId: timelineSource.rootSessionId,
    segmentsById,
    session: detail.bundle.session,
    sessions: timelineSource.sessions,
    sessionsById: timelineSource.sessionsById,
    sessionTokenTotals,
    startedAtMs,
    timeRangeMs: Math.max(latestAtMs - startedAtMs, 1),
    turnBands,
    turnBandsById,
  };
}

export function resolveTimelineSelection(
  projection: TimelineProjection | null,
  selection: TimelineSelection,
) {
  if (!projection) {
    return null;
  }

  if (selection.kind === "session") {
    return emptySelectionContext();
  }

  if (selection.kind === "item") {
    const selectedItem = projection.itemsById[selection.itemId] ?? null;
    if (!selectedItem) {
      return emptySelectionContext();
    }

    const relation = projection.relationMap.items[selection.itemId];
    const selectedSegment = relation?.segmentId
      ? projection.segmentsById[relation.segmentId] ?? null
      : null;
    const scope = selectionScope(projection, relation?.turnBandId ?? null);

    return {
      anchorItemId: selectedItem.itemId,
      ...scope,
      selectedConnector: null,
      selectedItem,
      selectedSegment,
    } satisfies TimelineSelectionContext;
  }

  if (selection.kind === "segment") {
    const selectedSegment = projection.segmentsById[selection.segmentId] ?? null;
    if (!selectedSegment) {
      return emptySelectionContext();
    }

    const selectedItem =
      projection.itemsById[selection.anchorItemId] ??
      projection.itemsById[selectedSegment.anchorItemId] ??
      null;
    const scope = selectionScope(projection, selectedSegment.turnBandId);

    return {
      anchorItemId: selectedItem?.itemId ?? selectedSegment.anchorItemId,
      ...scope,
      selectedConnector: null,
      selectedItem,
      selectedSegment,
    } satisfies TimelineSelectionContext;
  }

  const selectedConnector = projection.connectorsById[selection.connectorId] ?? null;
  if (!selectedConnector) {
    return emptySelectionContext();
  }

  const selectedItem =
    projection.itemsById[selection.anchorItemId] ??
    projection.itemsById[selectedConnector.anchorItemId] ??
    null;
  const scope = selectionScope(projection, selectedConnector.turnBandId);

  return {
    anchorItemId: selectedItem?.itemId ?? selectedConnector.anchorItemId,
    ...scope,
    selectedConnector,
    selectedItem,
    selectedSegment: null,
  } satisfies TimelineSelectionContext;
}
