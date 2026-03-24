import type { EventRecord } from "../../run";
import { parseJsonRecord, readStringArray } from "../lib/toolPreview";
import type {
  IndexedSubagentMaps,
  SessionLinkContext,
} from "./subagentLinkTypes";
import { readLinkedSubagent as readResolvedSubagent } from "./subagentSessionResolver";

interface ToolSessionLinks {
  codexAgentIdToSessionId: SessionLinkContext["codexAgentIdToSessionId"];
  parentFunctionArgsByEventId: SessionLinkContext["parentFunctionArgsByEventId"];
}

interface ToolMetadataOptions {
  event: EventRecord;
  parsedArgs: Record<string, unknown>;
  indexedSubagents: IndexedSubagentMaps;
  sessionLinks: ToolSessionLinks;
}

interface EventToolMetadataOptions {
  event: EventRecord;
  indexedSubagents: IndexedSubagentMaps;
  sessionLinks: ToolSessionLinks;
}

interface ResolveLinkedSubagentRecordOptions {
  parsedArgs: Record<string, unknown>;
  indexedSubagents: IndexedSubagentMaps;
  sessionLinks: ToolSessionLinks;
}

interface ResolvedEventToolMetadata {
  handler: (options: ToolMetadataOptions) => void;
  parsedArgs: Record<string, unknown>;
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
  sessionLinks: ToolSessionLinks,
) {
  for (const event of events) {
    applyEventToolMetadata({ event, indexedSubagents, sessionLinks });
  }
}

function applyEventToolMetadata(options: EventToolMetadataOptions) {
  const resolved = resolveEventToolMetadata(options);
  if (!resolved) {
    return;
  }

  resolved.handler({ ...options, parsedArgs: resolved.parsedArgs });
}

function resolveEventToolMetadata(
  options: EventToolMetadataOptions,
): ResolvedEventToolMetadata | null {
  const { event, sessionLinks } = options;
  if (!event.toolName) {
    return null;
  }

  const parsedArgs = readToolArgs(event, sessionLinks);
  if (!parsedArgs) {
    return null;
  }

  const handler = TOOL_METADATA_HANDLERS[event.toolName];
  return handler ? { handler, parsedArgs } : null;
}

function readToolArgs(
  event: EventRecord,
  sessionLinks: Pick<ToolSessionLinks, "parentFunctionArgsByEventId">,
) {
  const rawArgs =
    sessionLinks.parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview;
  return parseJsonRecord(rawArgs);
}

function applyInteractiveToolMetadata(options: ToolMetadataOptions) {
  const { event } = options;
  const subagent = resolveLinkedSubagentRecord(options);
  if (!subagent) {
    return;
  }

  event.title =
    event.toolName === "resume_agent"
      ? `Resume (${subagent.agentNickname})`
      : `Send to ${subagent.agentNickname}`;
}

function applyCloseAgentMetadata(options: ToolMetadataOptions) {
  const { event } = options;
  const subagent = resolveLinkedSubagentRecord(options);
  if (!subagent) {
    return;
  }

  event.title = `Close (${subagent.agentNickname})`;
  event.outputPreview = `${subagent.agentNickname} (${subagent.agentRole})`;
}

function applyWaitToolMetadata(options: ToolMetadataOptions) {
  const { event } = options;
  const nicknames = readWaitNicknames(options);
  if (nicknames.length > 0) {
    event.title = `Wait (${nicknames.join(", ")})`;
  }
}

function resolveLinkedSubagentRecord(
  options: ResolveLinkedSubagentRecordOptions,
) {
  const { parsedArgs, indexedSubagents, sessionLinks } = options;
  return readResolvedSubagent(parsedArgs, indexedSubagents, sessionLinks);
}

function readWaitNicknames(options: ResolveLinkedSubagentRecordOptions) {
  const { parsedArgs, indexedSubagents, sessionLinks } = options;
  return readStringArray({ record: parsedArgs, key: "ids" })
    .map(
      (agentId) =>
        sessionLinks.codexAgentIdToSessionId.get(agentId) ??
        (indexedSubagents.bySessionId.has(agentId) ? agentId : null),
    )
    .filter((sessionId): sessionId is string => sessionId !== null)
    .map((sessionId) => indexedSubagents.bySessionId.get(sessionId)?.agentNickname)
    .filter((nickname): nickname is string => nickname !== undefined);
}
