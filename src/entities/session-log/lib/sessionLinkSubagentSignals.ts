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

interface SpawnAgentLink {
  agentId: string | null | undefined;
  sessionId: string;
  spawnSourceEventId: string | null;
}

interface SpawnAgentLinkReadOptions {
  entry: SessionLogSnapshot["entries"][number];
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
}

interface RegisterWaitAgentErrorOptions {
  agentId: string;
  agentStatus: unknown;
  indexedSubagents: IndexedSubagents;
  sessionLinks: SessionLinkMaps;
}

interface SpawnAgentCallContext {
  functionCallId: string;
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
}

interface BuildSpawnAgentLinkOptions {
  spawnCallContext: SpawnAgentCallContext;
  matchedSubagent: IndexedSubagents["bySessionId"] extends Map<string, infer TValue>
    ? TValue
    : never;
  agentId: string | null | undefined;
}

interface ResolvedSpawnAgentLink {
  matchedSubagent: BuildSpawnAgentLinkOptions["matchedSubagent"];
  agentId: string | null | undefined;
}

interface ResolveSpawnAgentLinkDetailsOptions {
  indexedSubagents: IndexedSubagents;
  parsedRecord: ReturnType<typeof parseJsonRecord>;
}

export function collectSpawnAgentLinks(options: SubagentSignalOptions) {
  const { entry, indexedSubagents, callMaps, sessionLinks } = options;
  const spawnLink = readSpawnAgentLink({
    entry,
    indexedSubagents,
    callMaps,
  });
  applySpawnAgentLink(spawnLink, sessionLinks);
}

export function collectWaitAgentErrors(options: SubagentSignalOptions) {
  const { entry, indexedSubagents, callMaps, sessionLinks } = options;
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

function readSpawnAgentLink(options: SpawnAgentLinkReadOptions) {
  const { entry, indexedSubagents, callMaps } = options;
  const spawnCallContext = resolveSpawnAgentCallContext({
    functionCallId: entry.functionCallId ?? "",
    indexedSubagents,
    callMaps,
  });
  if (!spawnCallContext) {
    return null;
  }

  const resolvedLink = resolveSpawnAgentLinkDetails(
    {
      indexedSubagents,
      parsedRecord: parseJsonRecord(entry.text),
    },
  );
  if (!resolvedLink) {
    return null;
  }

  return buildSpawnAgentLink({
    spawnCallContext,
    matchedSubagent: resolvedLink.matchedSubagent,
    agentId: resolvedLink.agentId,
  });
}

function resolveSpawnAgentCallContext(
  options: SpawnAgentCallContext,
): SpawnAgentCallContext | null {
  const { functionCallId, callMaps } = options;
  if (!functionCallId) {
    return null;
  }

  return callMaps.callIdToName.get(functionCallId) === "spawn_agent" ? options : null;
}

function buildSpawnAgentLink(options: BuildSpawnAgentLinkOptions): SpawnAgentLink {
  const { spawnCallContext, matchedSubagent, agentId } = options;
  return {
    agentId,
    sessionId: matchedSubagent.sessionId,
    spawnSourceEventId:
      spawnCallContext.callMaps.spawnCallIdToEventId.get(
        spawnCallContext.functionCallId,
      ) ?? null,
  };
}

function resolveSpawnAgentLinkDetails(
  options: ResolveSpawnAgentLinkDetailsOptions,
): ResolvedSpawnAgentLink | null {
  const { indexedSubagents, parsedRecord } = options;
  const { agentId, nickname } = readAgentReference(parsedRecord);
  const matchedSubagent = resolveLinkedSubagent(indexedSubagents, agentId, nickname);
  return matchedSubagent ? { matchedSubagent, agentId } : null;
}

function applySpawnAgentLink(
  spawnLink: SpawnAgentLink | null,
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

function registerWaitAgentError(options: RegisterWaitAgentErrorOptions) {
  const { agentId, agentStatus, indexedSubagents, sessionLinks } = options;
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
