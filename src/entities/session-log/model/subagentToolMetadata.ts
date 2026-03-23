import type { EventRecord } from "../../run";
import { parseJsonRecord, readStringArray } from "../lib/toolPreview";
import type {
  IndexedSubagentMaps,
  SessionLinkContext,
} from "./subagentLinkTypes";
import { readLinkedSubagent as readResolvedSubagent } from "./subagentSessionResolver";

interface ToolMetadataOptions {
  event: EventRecord;
  parsedArgs: Record<string, unknown>;
  indexedSubagents: IndexedSubagentMaps;
  sessionLinks: Pick<
    SessionLinkContext,
    "codexAgentIdToSessionId" | "parentFunctionArgsByEventId"
  >;
}

const TOOL_METADATA_HANDLERS: Partial<
  Record<string, (options: ToolMetadataOptions) => void>
> = {
  close_agent: applyCloseAgentMetadata,
  resume_agent: applyInteractiveToolMetadata,
  send_input: applyInteractiveToolMetadata,
  wait: applyWaitToolMetadata,
  wait_agent: applyWaitToolMetadata,
};

export function applySubagentToolMetadata(
  events: EventRecord[],
  indexedSubagents: IndexedSubagentMaps,
  sessionLinks: Pick<
    SessionLinkContext,
    "codexAgentIdToSessionId" | "parentFunctionArgsByEventId"
  >,
) {
  for (const event of events) {
    applyEventToolMetadata(event, indexedSubagents, sessionLinks);
  }
}

function applyEventToolMetadata(
  event: EventRecord,
  indexedSubagents: IndexedSubagentMaps,
  sessionLinks: Pick<
    SessionLinkContext,
    "codexAgentIdToSessionId" | "parentFunctionArgsByEventId"
  >,
) {
  if (!event.toolName) {
    return;
  }

  const parsedArgs = readToolArgs(event, sessionLinks);
  if (!parsedArgs) {
    return;
  }

  const handler = TOOL_METADATA_HANDLERS[event.toolName];
  if (handler) {
    handler({ event, parsedArgs, indexedSubagents, sessionLinks });
  }
}

function readToolArgs(
  event: EventRecord,
  sessionLinks: Pick<SessionLinkContext, "parentFunctionArgsByEventId">,
) {
  const rawArgs =
    sessionLinks.parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview;
  return parseJsonRecord(rawArgs);
}

function applyInteractiveToolMetadata({
  event,
  parsedArgs,
  indexedSubagents,
  sessionLinks,
}: ToolMetadataOptions) {
  const subagent = resolveLinkedSubagentRecord({
    parsedArgs,
    indexedSubagents,
    sessionLinks,
  });
  if (!subagent) {
    return;
  }

  event.title =
    event.toolName === "resume_agent"
      ? `Resume (${subagent.agentNickname})`
      : `Send to ${subagent.agentNickname}`;
}

function applyCloseAgentMetadata({
  event,
  parsedArgs,
  indexedSubagents,
  sessionLinks,
}: ToolMetadataOptions) {
  const subagent = resolveLinkedSubagentRecord({
    parsedArgs,
    indexedSubagents,
    sessionLinks,
  });
  if (!subagent) {
    return;
  }

  event.title = `Close (${subagent.agentNickname})`;
  event.outputPreview = `${subagent.agentNickname} (${subagent.agentRole})`;
}

function applyWaitToolMetadata({
  event,
  parsedArgs,
  indexedSubagents,
  sessionLinks,
}: ToolMetadataOptions) {
  const nicknames = readWaitNicknames({
    parsedArgs,
    indexedSubagents,
    sessionLinks,
  });
  if (nicknames.length > 0) {
    event.title = `Wait (${nicknames.join(", ")})`;
  }
}

function resolveLinkedSubagentRecord({
  parsedArgs,
  indexedSubagents,
  sessionLinks,
}: Pick<
  ToolMetadataOptions,
  "parsedArgs" | "indexedSubagents" | "sessionLinks"
>) {
  return readResolvedSubagent(parsedArgs, indexedSubagents, sessionLinks);
}

function readWaitNicknames({
  parsedArgs,
  indexedSubagents,
  sessionLinks,
}: Pick<
  ToolMetadataOptions,
  "parsedArgs" | "indexedSubagents" | "sessionLinks"
>) {
  return readStringArray(parsedArgs, "ids")
    .map(
      (agentId) =>
        sessionLinks.codexAgentIdToSessionId.get(agentId) ??
        (indexedSubagents.bySessionId.has(agentId) ? agentId : null),
    )
    .filter((sessionId): sessionId is string => sessionId !== null)
    .map((sessionId) => indexedSubagents.bySessionId.get(sessionId)?.agentNickname)
    .filter((nickname): nickname is string => nickname !== undefined);
}
