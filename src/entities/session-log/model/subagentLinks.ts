import type {
  AgentLane,
  EdgeRecord,
  EventRecord,
} from "../../run";
import { parseJsonRecord, readStringArray } from "../lib/toolPreview";
import type { TimedSubagentSnapshot } from "./types";

interface IndexedSubagentMaps {
  bySessionId: Map<string, TimedSubagentSnapshot>;
}

interface SessionLinkContext {
  callEventToOutputEvent: Map<string, string>;
  codexAgentIdToSessionId: Map<string, string>;
  parentFunctionArgsByEventId: Map<string, string | null>;
}

export function labelSpawnSourceEvents(
  subagentToSpawnSource: Map<string, string>,
  indexedSubagents: IndexedSubagentMaps,
  eventsById: Map<string, EventRecord>,
) {
  for (const [sessionId, eventId] of subagentToSpawnSource) {
    const sub = indexedSubagents.bySessionId.get(sessionId);
    const event = eventsById.get(eventId);
    if (sub && event) {
      event.title = `spawn_agent (${sub.agentNickname})`;
    }
  }
}

export function buildSubagentMergeEdges({
  parentEvents,
  mainLane,
  indexedSubagents,
  eventsById,
  latestSubagentEventBySessionId,
  sessionLinks,
}: {
  parentEvents: EventRecord[];
  mainLane: AgentLane;
  indexedSubagents: IndexedSubagentMaps;
  eventsById: Map<string, EventRecord>;
  latestSubagentEventBySessionId: Map<string, EventRecord>;
  sessionLinks: SessionLinkContext;
}) {
  const { callEventToOutputEvent, codexAgentIdToSessionId, parentFunctionArgsByEventId } =
    sessionLinks;
  const mergeEdgeCandidates = new Map<string, { edge: EdgeRecord; targetTs: number }>();

  const resolveSessionId = (agentId: string): string | undefined =>
    codexAgentIdToSessionId.get(agentId) ??
    (indexedSubagents.bySessionId.has(agentId) ? agentId : undefined);

  const resolveMergeSource = (sessionId: string, targetEventId: string): string | null => {
    const lastEventId = latestSubagentEventBySessionId.get(sessionId)?.eventId ?? null;
    if (!lastEventId) {
      return null;
    }

    const sourceTs = eventsById.get(lastEventId)?.startTs ?? 0;
    const targetTs = eventsById.get(targetEventId)?.startTs ?? 0;
    if (sourceTs <= targetTs) {
      return lastEventId;
    }

    const spawnedEventId = `${sessionId}:spawn`;
    return eventsById.has(spawnedEventId) ? spawnedEventId : lastEventId;
  };

  const parseParentFunctionArgs = (event: EventRecord) =>
    parseJsonRecord(parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview);

  const upsertMergeCandidate = (sessionId: string, edge: EdgeRecord) => {
    const targetTs = eventsById.get(edge.targetEventId)?.startTs ?? 0;
    const existing = mergeEdgeCandidates.get(sessionId);
    if (!existing || targetTs > existing.targetTs) {
      mergeEdgeCandidates.set(sessionId, { edge, targetTs });
    }
  };

  for (const event of parentEvents) {
    if (event.toolName !== "close_agent") {
      continue;
    }

    const args = parseParentFunctionArgs(event);
    const agentId = typeof args?.id === "string" ? args.id : null;
    const sessionId = agentId ? resolveSessionId(agentId) : undefined;
    if (!sessionId) {
      continue;
    }

    const sub = indexedSubagents.bySessionId.get(sessionId);
    const resolvedTarget = callEventToOutputEvent.get(event.eventId) ?? event.eventId;
    const mergeSourceId = resolveMergeSource(sessionId, resolvedTarget);
    if (!mergeSourceId) {
      continue;
    }

    upsertMergeCandidate(sessionId, {
      edgeId: `merge:close:${sessionId}`,
      edgeType: "merge",
      sourceAgentId: `${sessionId}:sub`,
      targetAgentId: mainLane.agentId,
      sourceEventId: mergeSourceId,
      targetEventId: resolvedTarget,
      payloadPreview: `${sub?.agentNickname ?? "Agent"} result`,
      artifactId: null,
    });
  }

  for (const event of parentEvents) {
    if (event.toolName !== "wait" && event.toolName !== "wait_agent") {
      continue;
    }

    const args = parseParentFunctionArgs(event);
    const resolvedTarget = callEventToOutputEvent.get(event.eventId) ?? event.eventId;
    for (const agentId of readStringArray(args, "ids")) {
      const sessionId = resolveSessionId(agentId);
      if (!sessionId) {
        continue;
      }

      const sub = indexedSubagents.bySessionId.get(sessionId);
      const mergeSourceId = resolveMergeSource(sessionId, resolvedTarget);
      if (!mergeSourceId) {
        continue;
      }

      upsertMergeCandidate(sessionId, {
        edgeId: `merge:wait:${sessionId}`,
        edgeType: "merge",
        sourceAgentId: `${sessionId}:sub`,
        targetAgentId: mainLane.agentId,
        sourceEventId: mergeSourceId,
        targetEventId: resolvedTarget,
        payloadPreview: `${sub?.agentNickname ?? "Agent"} joined`,
        artifactId: null,
      });
    }
  }

  return [...mergeEdgeCandidates.values()].map(({ edge }) => edge);
}

export function applySubagentToolMetadata(
  events: EventRecord[],
  indexedSubagents: IndexedSubagentMaps,
  sessionLinks: Pick<SessionLinkContext, "codexAgentIdToSessionId" | "parentFunctionArgsByEventId">,
) {
  const { codexAgentIdToSessionId, parentFunctionArgsByEventId } = sessionLinks;
  const resolveSessionId = (agentId: string): string | undefined =>
    codexAgentIdToSessionId.get(agentId) ??
    (indexedSubagents.bySessionId.has(agentId) ? agentId : undefined);

  for (const event of events) {
    if (!event.toolName) {
      continue;
    }

    const args = parseJsonRecord(
      parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview,
    );
    if (!args) {
      continue;
    }

    if (event.toolName === "resume_agent" || event.toolName === "send_input") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      const sub = sessionId ? indexedSubagents.bySessionId.get(sessionId) : undefined;
      if (!sub) {
        continue;
      }

      event.title =
        event.toolName === "resume_agent"
          ? `Resume (${sub.agentNickname})`
          : `Send to ${sub.agentNickname}`;
      continue;
    }

    if (event.toolName === "close_agent") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      const sub = sessionId ? indexedSubagents.bySessionId.get(sessionId) : undefined;
      if (!sub) {
        continue;
      }

      event.title = `Close (${sub.agentNickname})`;
      event.outputPreview = `${sub.agentNickname} (${sub.agentRole})`;
      continue;
    }

    if (event.toolName !== "wait" && event.toolName !== "wait_agent") {
      continue;
    }

    const names = readStringArray(args, "ids")
      .map((id) => resolveSessionId(id))
      .filter((sessionId): sessionId is string => sessionId !== undefined)
      .map((sessionId) => indexedSubagents.bySessionId.get(sessionId)?.agentNickname)
      .filter((name): name is string => name !== undefined);
    if (names.length > 0) {
      event.title = `Wait (${names.join(", ")})`;
    }
  }
}
