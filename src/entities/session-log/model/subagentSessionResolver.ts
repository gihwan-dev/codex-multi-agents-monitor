import type { EventRecord } from "../../run";
import { parseJsonRecord } from "../lib/toolPreview";
import type {
  IndexedSubagentMaps,
  SessionLinkContext,
} from "./subagentLinkTypes";

export function readParentFunctionArgs(
  event: EventRecord,
  sessionLinks: Pick<SessionLinkContext, "parentFunctionArgsByEventId">,
) {
  const rawArgs =
    sessionLinks.parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview;
  return parseJsonRecord(rawArgs);
}

export function resolveLinkedSessionId(
  agentId: string,
  indexedSubagents: IndexedSubagentMaps,
  sessionLinks: Pick<SessionLinkContext, "codexAgentIdToSessionId">,
) {
  return (
    sessionLinks.codexAgentIdToSessionId.get(agentId) ??
    (indexedSubagents.bySessionId.has(agentId) ? agentId : undefined)
  );
}

export function readLinkedSubagent(
  parsedArgs: Record<string, unknown>,
  indexedSubagents: IndexedSubagentMaps,
  sessionLinks: Pick<SessionLinkContext, "codexAgentIdToSessionId">,
) {
  const agentId = typeof parsedArgs.id === "string" ? parsedArgs.id : null;
  if (!agentId) {
    return null;
  }

  const resolvedSessionId = resolveLinkedSessionId(
    agentId,
    indexedSubagents,
    sessionLinks,
  );
  return resolvedSessionId
    ? indexedSubagents.bySessionId.get(resolvedSessionId) ?? null
    : null;
}
