import type { SessionLogSnapshot } from "../model/types";
import type { CallMaps } from "./sessionLinkCallMaps";
import type { IndexedSubagents, SessionLinkMaps } from "./sessionLinkTypes";

export interface SubagentSignalOptions {
  entry: SessionLogSnapshot["entries"][number];
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
  sessionLinks: SessionLinkMaps;
}

export interface SpawnAgentLink {
  agentId: string | null | undefined;
  sessionId: string;
  spawnSourceEventId: string | null;
}

export interface SpawnAgentLinkReadOptions {
  entry: SessionLogSnapshot["entries"][number];
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
}

export interface RegisterWaitAgentErrorOptions {
  agentId: string;
  agentStatus: unknown;
  indexedSubagents: IndexedSubagents;
  sessionLinks: SessionLinkMaps;
}

export interface SpawnAgentCallContext {
  functionCallId: string;
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
}

export interface BuildSpawnAgentLinkOptions {
  spawnCallContext: SpawnAgentCallContext;
  matchedSubagent: IndexedSubagents["bySessionId"] extends Map<string, infer TValue>
    ? TValue
    : never;
  agentId: string | null | undefined;
}

export interface ResolvedSpawnAgentLink {
  matchedSubagent: BuildSpawnAgentLinkOptions["matchedSubagent"];
  agentId: string | null | undefined;
}
