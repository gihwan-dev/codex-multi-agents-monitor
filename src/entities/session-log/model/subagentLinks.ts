import type {
  EventRecord,
} from "../../run";
import type { IndexedSubagentMaps } from "./subagentLinkTypes";

export { buildSubagentMergeEdges } from "./subagentMergeEdges";
export { applySubagentToolMetadata } from "./subagentToolMetadata";

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
