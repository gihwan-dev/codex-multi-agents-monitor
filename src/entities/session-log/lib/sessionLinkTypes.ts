import type { TimedSubagentSnapshot } from "../model/types";

export interface IndexedSubagents {
  bySessionId: Map<string, TimedSubagentSnapshot>;
  byNickname: Map<string, TimedSubagentSnapshot>;
}

export interface SessionLinkMaps {
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
  codexAgentIdToSessionId: Map<string, string>;
  callEventToOutputEvent: Map<string, string>;
  parentFunctionArgsByEventId: Map<string, string | null>;
}
