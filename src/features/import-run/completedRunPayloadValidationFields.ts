import {
  EDGE_TYPES,
  EVENT_TYPES,
  LIVE_MODES,
  RUN_ENVIRONMENTS,
  RUN_STATUSES,
} from "../../entities/run";

export const RUN_STRING_FIELDS = ["traceId", "title"] as const;
export const PROJECT_STRING_FIELDS = ["projectId", "name", "repoPath"] as const;
export const SESSION_STRING_FIELDS = ["sessionId", "title", "owner"] as const;
export const LANE_STRING_FIELDS = [
  "laneId",
  "agentId",
  "threadId",
  "name",
  "role",
  "model",
  "provider",
  "badge",
] as const;
export const EDGE_STRING_FIELDS = [
  "edgeId",
  "sourceAgentId",
  "targetAgentId",
  "sourceEventId",
  "targetEventId",
] as const;
export const ARTIFACT_STRING_FIELDS = [
  "artifactId",
  "title",
  "artifactRef",
  "producerEventId",
  "preview",
] as const;
export const PROMPT_LAYER_STRING_FIELDS = [
  "layerId",
  "layerType",
  "label",
  "preview",
] as const;
export const EVENT_STRING_FIELDS = [
  "event_id",
  "lane_id",
  "agent_id",
  "thread_id",
  "title",
] as const;
export const RUN_ENUM_FIELDS = [
  ["status", RUN_STATUSES],
  ["environment", RUN_ENVIRONMENTS],
  ["liveMode", LIVE_MODES],
] as const;

export {
  EDGE_TYPES,
  EVENT_TYPES,
  LIVE_MODES,
  RUN_ENVIRONMENTS,
  RUN_STATUSES,
};
