import type {
  AgentLane,
  EdgeRecord,
  EventRecord,
} from "../../run";
import { readStringArray } from "../lib/toolPreview";
import type {
  IndexedSubagentMaps,
  SessionLinkContext,
} from "./subagentLinkTypes";
import {
  readParentFunctionArgs,
  resolveLinkedSessionId,
} from "./subagentSessionResolver";

interface BuildSubagentMergeEdgesArgs {
  parentEvents: EventRecord[];
  mainLane: AgentLane;
  indexedSubagents: IndexedSubagentMaps;
  eventsById: Map<string, EventRecord>;
  latestSubagentEventBySessionId: Map<string, EventRecord>;
  sessionLinks: SessionLinkContext;
}

interface MergeCandidate {
  edge: EdgeRecord;
  targetTs: number;
}

export function buildSubagentMergeEdges(
  args: BuildSubagentMergeEdgesArgs,
) {
  const mergeCandidates = new Map<string, MergeCandidate>();
  collectCloseAgentMergeEdges(args, mergeCandidates);
  collectWaitAgentMergeEdges(args, mergeCandidates);
  return [...mergeCandidates.values()].map(({ edge }) => edge);
}

function collectCloseAgentMergeEdges(
  args: BuildSubagentMergeEdgesArgs,
  mergeCandidates: Map<string, MergeCandidate>,
) {
  for (const event of args.parentEvents) {
    if (event.toolName !== "close_agent") {
      continue;
    }

    const sessionId = resolveSingleSessionId(event, args);
    if (!sessionId) {
      continue;
    }

    upsertMergeCandidate(
      {
        sessionId,
        edge: buildMergeEdge({
          event,
          sessionId,
          args,
          edgeId: `merge:close:${sessionId}`,
          payloadSuffix: "result",
        }),
        args,
        mergeCandidates,
      },
    );
  }
}

function collectWaitAgentMergeEdges(
  args: BuildSubagentMergeEdgesArgs,
  mergeCandidates: Map<string, MergeCandidate>,
) {
  for (const event of args.parentEvents) {
    if (event.toolName !== "wait" && event.toolName !== "wait_agent") {
      continue;
    }

    for (const sessionId of resolveWaitSessionIds(event, args)) {
      upsertMergeCandidate(
        {
          sessionId,
          edge: buildMergeEdge({
            event,
            sessionId,
            args,
            edgeId: `merge:wait:${sessionId}`,
            payloadSuffix: "joined",
          }),
          args,
          mergeCandidates,
        },
      );
    }
  }
}

function resolveSingleSessionId(
  event: EventRecord,
  args: BuildSubagentMergeEdgesArgs,
) {
  const parsedArgs = readParentFunctionArgs(event, args.sessionLinks);
  const agentId = typeof parsedArgs?.id === "string" ? parsedArgs.id : null;
  return agentId
    ? resolveLinkedSessionId(agentId, args.indexedSubagents, args.sessionLinks)
    : undefined;
}

function resolveWaitSessionIds(
  event: EventRecord,
  args: BuildSubagentMergeEdgesArgs,
) {
  return readStringArray(readParentFunctionArgs(event, args.sessionLinks), "ids")
    .map((agentId) =>
      resolveLinkedSessionId(agentId, args.indexedSubagents, args.sessionLinks),
    )
    .filter((sessionId): sessionId is string => sessionId !== undefined);
}

function buildMergeEdge({
  event,
  sessionId,
  args,
  edgeId,
  payloadSuffix,
}: {
  event: EventRecord;
  sessionId: string;
  args: BuildSubagentMergeEdgesArgs;
  edgeId: string;
  payloadSuffix: string;
}) {
  const targetEventId = readTargetEventId(event, args);
  const sourceEventId = resolveMergeSource({ sessionId, targetEventId, args });
  if (!sourceEventId) {
    return null;
  }

  const nickname =
    args.indexedSubagents.bySessionId.get(sessionId)?.agentNickname ?? "Agent";
  return {
    edgeId,
    edgeType: "merge",
    sourceAgentId: `${sessionId}:sub`,
    targetAgentId: args.mainLane.agentId,
    sourceEventId,
    targetEventId,
    payloadPreview: `${nickname} ${payloadSuffix}`,
    artifactId: null,
  } satisfies EdgeRecord;
}

function readTargetEventId(
  event: EventRecord,
  args: BuildSubagentMergeEdgesArgs,
) {
  return args.sessionLinks.callEventToOutputEvent.get(event.eventId) ?? event.eventId;
}

function resolveMergeSource({
  sessionId,
  targetEventId,
  args,
}: {
  sessionId: string;
  targetEventId: string;
  args: BuildSubagentMergeEdgesArgs;
}) {
  const lastEventId =
    args.latestSubagentEventBySessionId.get(sessionId)?.eventId ?? null;
  if (!lastEventId) {
    return null;
  }

  return shouldUseLatestSubagentEvent(lastEventId, targetEventId, args)
    ? lastEventId
    : readSpawnFallbackEventId(sessionId, lastEventId, args);
}

function shouldUseLatestSubagentEvent(
  lastEventId: string,
  targetEventId: string,
  args: BuildSubagentMergeEdgesArgs,
) {
  const sourceTs = args.eventsById.get(lastEventId)?.startTs ?? 0;
  const targetTs = args.eventsById.get(targetEventId)?.startTs ?? 0;
  return sourceTs <= targetTs;
}

function readSpawnFallbackEventId(
  sessionId: string,
  lastEventId: string,
  args: BuildSubagentMergeEdgesArgs,
) {
  const spawnedEventId = `${sessionId}:spawn`;
  return args.eventsById.has(spawnedEventId) ? spawnedEventId : lastEventId;
}

function upsertMergeCandidate({
  sessionId,
  edge,
  args,
  mergeCandidates,
}: {
  sessionId: string;
  edge: EdgeRecord | null;
  args: BuildSubagentMergeEdgesArgs;
  mergeCandidates: Map<string, MergeCandidate>;
}) {
  if (!edge) {
    return;
  }

  const targetTs = args.eventsById.get(edge.targetEventId)?.startTs ?? 0;
  const existing = mergeCandidates.get(sessionId);
  if (!existing || targetTs > existing.targetTs) {
    mergeCandidates.set(sessionId, { edge, targetTs });
  }
}
