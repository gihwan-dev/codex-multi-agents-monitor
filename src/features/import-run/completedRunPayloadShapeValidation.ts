import {
  EDGE_TYPES,
  type EdgeRecord,
  EVENT_TYPES,
  LIVE_MODES,
  type PromptAssembly,
  type RawImportEvent,
  type RawImportPayload,
  RUN_ENVIRONMENTS,
  RUN_STATUSES,
} from "../../entities/run";
import {
  assertArrayField,
  assertEnumField,
  assertNumberField,
  assertOptionalString,
  assertStringField,
  assertTimestampRange,
  isRecord,
} from "./completedRunPayloadValidationPrimitives";
import type { ValidatedCompletedRunPayload } from "./completedRunPayloadValidationTypes";

function validateRunPayload(record: Record<string, unknown>) {
  assertStringField(record, "traceId");
  assertStringField(record, "title");
  assertEnumField(record, "status", RUN_STATUSES);
  const startTs = assertNumberField(record, "startTs");
  if (record.endTs !== null && record.endTs !== undefined) {
    const endTs = assertNumberField(record, "endTs");
    assertTimestampRange(startTs, endTs, "run");
  }
  if (record.durationMs !== undefined) {
    assertNumberField(record, "durationMs");
  }
  assertEnumField(record, "environment", RUN_ENVIRONMENTS);
  assertEnumField(record, "liveMode", LIVE_MODES);
}

function validateProjectShape(record: Record<string, unknown>) {
  assertStringField(record, "projectId");
  assertStringField(record, "name");
  assertStringField(record, "repoPath");
  if (record.badge !== undefined && record.badge !== null) {
    assertOptionalString(record, "badge");
  }
}

function validateSessionShape(record: Record<string, unknown>) {
  assertStringField(record, "sessionId");
  assertStringField(record, "title");
  assertStringField(record, "owner");
  assertNumberField(record, "startedAt");
}

function validateLaneShape(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Invalid payload: lane entry must be an object.");
  }
  assertStringField(value, "laneId");
  assertStringField(value, "agentId");
  assertStringField(value, "threadId");
  assertStringField(value, "name");
  assertStringField(value, "role");
  assertStringField(value, "model");
  assertStringField(value, "provider");
  assertStringField(value, "badge");
  assertEnumField(value, "laneStatus", RUN_STATUSES);
}

function validateEventShape(value: unknown): asserts value is RawImportEvent {
  if (!isRecord(value)) {
    throw new Error("Invalid payload: event entry must be an object.");
  }
  assertStringField(value, "event_id");
  assertStringField(value, "lane_id");
  assertStringField(value, "agent_id");
  assertStringField(value, "thread_id");
  assertEnumField(value, "event_type", EVENT_TYPES);
  const status = assertEnumField(value, "status", RUN_STATUSES);
  const startTs = assertNumberField(value, "start_ts");
  assertStringField(value, "title");
  if (value.end_ts !== undefined && value.end_ts !== null) {
    const endTs = assertNumberField(value, "end_ts");
    assertTimestampRange(startTs, endTs, `event ${value.event_id}`);
  }
  if (value.retry_count !== undefined) {
    assertNumberField(value, "retry_count");
  }
  if (["waiting", "blocked", "interrupted"].includes(status) && typeof value.wait_reason !== "string") {
    throw new Error(`Invalid payload: wait_reason required for ${value.event_id}.`);
  }
}

function validateEdgeShape(value: unknown): asserts value is EdgeRecord {
  if (!isRecord(value)) {
    throw new Error("Invalid payload: edge entry must be an object.");
  }
  assertStringField(value, "edgeId");
  assertEnumField(value, "edgeType", EDGE_TYPES);
  assertStringField(value, "sourceAgentId");
  assertStringField(value, "targetAgentId");
  assertStringField(value, "sourceEventId");
  assertStringField(value, "targetEventId");
  if (value.payloadPreview !== null && value.payloadPreview !== undefined) {
    assertOptionalString(value, "payloadPreview");
  }
}

function validateArtifactShape(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Invalid payload: artifact entry must be an object.");
  }
  assertStringField(value, "artifactId");
  assertStringField(value, "title");
  assertStringField(value, "artifactRef");
  assertStringField(value, "producerEventId");
  assertStringField(value, "preview");
  assertOptionalString(value, "rawContent");
}

function validatePromptAssemblyLayerShape(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Invalid payload: promptAssembly layer entry must be an object.");
  }

  assertStringField(value, "layerId");
  assertStringField(value, "layerType");
  assertStringField(value, "label");
  assertStringField(value, "preview");
  assertNumberField(value, "contentLength");
  assertOptionalString(value, "rawContent");
}

function validatePromptAssemblyShape(value: unknown): asserts value is PromptAssembly {
  if (!isRecord(value)) {
    throw new Error("Invalid payload: promptAssembly must be an object.");
  }

  const layers = assertArrayField(value, "layers");
  assertNumberField(value, "totalContentLength");
  layers.forEach(validatePromptAssemblyLayerShape);
}

export function validateCompletedRunPayloadShape(parsed: unknown): ValidatedCompletedRunPayload {
  if (!isRecord(parsed)) {
    throw new Error("Invalid payload: root must be an object.");
  }

  if (!isRecord(parsed.project) || !isRecord(parsed.session) || !isRecord(parsed.run)) {
    throw new Error("Invalid payload: project, session, run are required.");
  }

  validateProjectShape(parsed.project);
  validateSessionShape(parsed.session);
  validateRunPayload(parsed.run);
  if (parsed.promptAssembly !== undefined) {
    validatePromptAssemblyShape(parsed.promptAssembly);
  }

  const lanes = assertArrayField(parsed, "lanes");
  const events = assertArrayField(parsed, "events");
  const edges = assertArrayField(parsed, "edges");
  const artifacts = assertArrayField(parsed, "artifacts");

  if (!lanes.length || !events.length) {
    throw new Error("Invalid payload: lanes and events are required.");
  }

  lanes.forEach(validateLaneShape);
  events.forEach(validateEventShape);
  edges.forEach(validateEdgeShape);
  artifacts.forEach(validateArtifactShape);

  return {
    project: parsed.project as unknown as RawImportPayload["project"],
    session: parsed.session as unknown as RawImportPayload["session"],
    run: parsed.run as RawImportPayload["run"],
    lanes: lanes as RawImportPayload["lanes"],
    events: events as RawImportPayload["events"],
    edges: edges as RawImportPayload["edges"],
    artifacts: artifacts as RawImportPayload["artifacts"],
    promptAssembly: parsed.promptAssembly as RawImportPayload["promptAssembly"],
  };
}
