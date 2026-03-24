import type { AgentLane, EdgeRecord, EventRecord } from "../../run";
import type { IndexedSubagentMaps, SessionLinkContext } from "./subagentLinkTypes";

export interface BuildSubagentMergeEdgesArgs {
  parentEvents: EventRecord[];
  mainLane: AgentLane;
  indexedSubagents: IndexedSubagentMaps;
  eventsById: Map<string, EventRecord>;
  latestSubagentEventBySessionId: Map<string, EventRecord>;
  sessionLinks: SessionLinkContext;
}

export interface MergeCandidate {
  edge: EdgeRecord;
  targetTs: number;
}

export interface SingleSessionIdOptions {
  event: EventRecord;
  args: BuildSubagentMergeEdgesArgs;
}

export interface BuildMergeEdgeOptions {
  event: EventRecord;
  sessionId: string;
  args: BuildSubagentMergeEdgesArgs;
  edgeId: string;
  payloadSuffix: string;
}

export interface ResolveMergeSourceOptions {
  sessionId: string;
  targetEventId: string;
  args: BuildSubagentMergeEdgesArgs;
}

export interface MergeSourceTimingOptions {
  lastEventId: string;
  targetEventId: string;
  args: BuildSubagentMergeEdgesArgs;
}

export interface SpawnFallbackEventIdOptions {
  sessionId: string;
  lastEventId: string;
  args: BuildSubagentMergeEdgesArgs;
}

export interface UpsertMergeCandidateOptions {
  sessionId: string;
  edge: EdgeRecord | null;
  args: BuildSubagentMergeEdgesArgs;
  mergeCandidates: Map<string, MergeCandidate>;
}

export interface MergeCandidateBuildOptions {
  event: EventRecord;
  sessionId: string;
  args: BuildSubagentMergeEdgesArgs;
  mergeCandidates: Map<string, MergeCandidate>;
}
