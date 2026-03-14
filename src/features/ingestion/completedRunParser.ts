import {
  EDGE_TYPES,
  type EdgeRecord,
  EVENT_TYPES,
  LIVE_MODES,
  type RawImportEvent,
  type RawImportPayload,
  RUN_ENVIRONMENTS,
  RUN_STATUSES,
} from "../../shared/domain/index.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (!isString(value) || !value.length) {
    throw new Error(`Invalid payload: ${key} must be a non-empty string.`);
  }
  return value;
}

function assertNumberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!isNumber(value)) {
    throw new Error(`Invalid payload: ${key} must be a finite number.`);
  }
  return value;
}

function assertOptionalString(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return value as null | undefined;
  }
  if (!isString(value)) {
    throw new Error(`Invalid payload: ${key} must be a string when provided.`);
  }
  return value;
}

function assertEnumField<const T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  values: T,
): T[number] {
  const value = record[key];
  if (!isString(value) || !values.includes(value)) {
    throw new Error(`Invalid payload: ${key} must be one of ${values.join(", ")}.`);
  }
  return value as T[number];
}

function assertArrayField(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Invalid payload: ${key} must be an array.`);
  }
  return value;
}

function validateRunPayload(record: Record<string, unknown>) {
  assertStringField(record, "traceId");
  assertStringField(record, "title");
  assertEnumField(record, "status", RUN_STATUSES);
  assertNumberField(record, "startTs");
  if (record.endTs !== null && record.endTs !== undefined) {
    assertNumberField(record, "endTs");
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
  assertNumberField(value, "start_ts");
  assertStringField(value, "title");
  if (value.end_ts !== undefined && value.end_ts !== null) {
    assertNumberField(value, "end_ts");
  }
  if (value.retry_count !== undefined) {
    assertNumberField(value, "retry_count");
  }
  if (["waiting", "blocked", "interrupted"].includes(status) && !isString(value.wait_reason)) {
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

export function parseCompletedRunPayload(input: string): RawImportPayload {
  const parsed = JSON.parse(input) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Invalid payload: root must be an object.");
  }

  if (!isRecord(parsed.project) || !isRecord(parsed.session) || !isRecord(parsed.run)) {
    throw new Error("Invalid payload: project, session, run are required.");
  }

  validateProjectShape(parsed.project);
  validateSessionShape(parsed.session);
  validateRunPayload(parsed.run);

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
    run: parsed.run as unknown as RawImportPayload["run"],
    lanes: lanes as unknown as RawImportPayload["lanes"],
    events: events as unknown as RawImportPayload["events"],
    edges: edges as unknown as RawImportPayload["edges"],
    artifacts: artifacts as unknown as RawImportPayload["artifacts"],
  };
}
