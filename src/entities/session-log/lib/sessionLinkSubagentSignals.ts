import type { SessionLogSnapshot } from "../model/types";
import type { CallMaps } from "./sessionLinkCallMaps";
import type {
  IndexedSubagents,
  SessionLinkMaps,
} from "./sessionLinkTypes";
import { parseJsonRecord, readAgentReference } from "./toolPreview";

interface SubagentSignalOptions {
  entry: SessionLogSnapshot["entries"][number];
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
  sessionLinks: SessionLinkMaps;
}

export function collectSpawnAgentLinks({
  entry,
  indexedSubagents,
  callMaps,
  sessionLinks,
}: SubagentSignalOptions) {
  const spawnLink = readSpawnAgentLink({
    entry,
    indexedSubagents,
    callMaps,
  });
  applySpawnAgentLink(spawnLink, sessionLinks);
}

export function collectWaitAgentErrors({
  entry,
  indexedSubagents,
  callMaps,
  sessionLinks,
}: SubagentSignalOptions) {
  if (!isWaitToolOutput(entry, callMaps)) {
    return;
  }

  const waitStatuses = readWaitStatuses(entry);
  if (!waitStatuses) {
    return;
  }

  for (const [agentId, agentStatus] of Object.entries(waitStatuses)) {
    registerWaitAgentError({
      agentId,
      agentStatus,
      indexedSubagents,
      sessionLinks,
    });
  }
}

function readWaitStatuses(entry: SessionLogSnapshot["entries"][number]) {
  const statuses = parseJsonRecord(entry.text)?.status;
  return statuses && typeof statuses === "object" ? statuses : null;
}

function readSpawnAgentLink({
  entry,
  indexedSubagents,
  callMaps,
}: Pick<SubagentSignalOptions, "entry" | "indexedSubagents" | "callMaps">) {
  if (callMaps.callIdToName.get(entry.functionCallId ?? "") !== "spawn_agent") {
    return null;
  }

  const { agentId, nickname } = readAgentReference(parseJsonRecord(entry.text));
  const matchedSubagent = resolveLinkedSubagent(indexedSubagents, agentId, nickname);
  if (!matchedSubagent) {
    return null;
  }

  return {
    agentId,
    sessionId: matchedSubagent.sessionId,
    spawnSourceEventId:
      callMaps.spawnCallIdToEventId.get(entry.functionCallId ?? "") ?? null,
  };
}

function applySpawnAgentLink(
  spawnLink:
    | {
        agentId: string | null | undefined;
        sessionId: string;
        spawnSourceEventId: string | null;
      }
    | null,
  sessionLinks: SessionLinkMaps,
) {
  if (!spawnLink) {
    return;
  }

  if (spawnLink.spawnSourceEventId) {
    sessionLinks.subagentToSpawnSource.set(
      spawnLink.sessionId,
      spawnLink.spawnSourceEventId,
    );
  }
  if (spawnLink.agentId) {
    sessionLinks.codexAgentIdToSessionId.set(spawnLink.agentId, spawnLink.sessionId);
  }
}

function registerWaitAgentError({
  agentId,
  agentStatus,
  indexedSubagents,
  sessionLinks,
}: {
  agentId: string;
  agentStatus: unknown;
  indexedSubagents: IndexedSubagents;
  sessionLinks: SessionLinkMaps;
}) {
  const errored = readErroredStatus(agentStatus);
  if (!errored) {
    return;
  }

  const resolvedSessionId =
    sessionLinks.codexAgentIdToSessionId.get(agentId) ?? agentId;
  if (
    indexedSubagents.bySessionId.has(resolvedSessionId) &&
    !sessionLinks.waitAgentErrors.has(resolvedSessionId)
  ) {
    sessionLinks.waitAgentErrors.set(resolvedSessionId, errored);
  }
}

function isWaitToolOutput(
  entry: SessionLogSnapshot["entries"][number],
  callMaps: CallMaps,
) {
  const toolName = callMaps.callIdToName.get(entry.functionCallId ?? "");
  return toolName === "wait" || toolName === "wait_agent";
}

function readErroredStatus(agentStatus: unknown) {
  if (!agentStatus || typeof agentStatus !== "object") {
    return null;
  }

  return typeof (agentStatus as Record<string, unknown>).errored === "string"
    ? ((agentStatus as Record<string, unknown>).errored as string)
    : null;
}

function resolveLinkedSubagent(
  indexedSubagents: IndexedSubagents,
  agentId: string | null | undefined,
  nickname: string | null | undefined,
) {
  if (agentId) {
    const bySessionId = indexedSubagents.bySessionId.get(agentId);
    if (bySessionId) {
      return bySessionId;
    }
  }

  return nickname
    ? indexedSubagents.byNickname.get(nickname) ?? null
    : null;
}
