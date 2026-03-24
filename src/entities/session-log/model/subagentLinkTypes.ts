import type { TimedSubagentSnapshot } from "./types";

export interface IndexedSubagentMaps {
  bySessionId: Map<string, TimedSubagentSnapshot>;
}

export interface SessionLinkContext {
  callEventToOutputEvent: Map<string, string>;
  codexAgentIdToSessionId: Map<string, string>;
  parentFunctionArgsByEventId: Map<string, string | null>;
}
