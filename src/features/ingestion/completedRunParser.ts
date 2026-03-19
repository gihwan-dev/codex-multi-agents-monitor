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

function assertTimestampRange(start: number, end: number, label: string) {
  if (end < start) {
    throw new Error(`Invalid payload: ${label} end timestamp must be greater than or equal to start timestamp.`);
  }
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

function collectUniqueIds<T>(
  items: T[],
  label: string,
  getId: (item: T) => string,
) {
  const ids = new Set<string>();
  for (const item of items) {
    const id = getId(item);
    if (ids.has(id)) {
      throw new Error(`Invalid payload: duplicate ${label} id ${id}.`);
    }
    ids.add(id);
  }
  return ids;
}

function validatePayloadReferences(payload: {
  run: RawImportPayload["run"];
  lanes: RawImportPayload["lanes"];
  events: RawImportPayload["events"];
  edges: RawImportPayload["edges"];
  artifacts: RawImportPayload["artifacts"];
}) {
  const laneIds = collectUniqueIds(payload.lanes, "lane", (lane) => lane.laneId);
  const eventIds = collectUniqueIds(payload.events, "event", (event) => event.event_id);
  const artifactIds = collectUniqueIds(
    payload.artifacts,
    "artifact",
    (artifact) => artifact.artifactId,
  );
  collectUniqueIds(payload.edges, "edge", (edge) => edge.edgeId);

  payload.events.forEach((event) => {
    if (!laneIds.has(event.lane_id)) {
      throw new Error(
        `Invalid payload: event ${event.event_id} references unknown lane ${event.lane_id}.`,
      );
    }

    if (event.artifact_id && !artifactIds.has(event.artifact_id)) {
      throw new Error(
        `Invalid payload: event ${event.event_id} references unknown artifact ${event.artifact_id}.`,
      );
    }
  });

  payload.edges.forEach((edge) => {
    if (!eventIds.has(edge.sourceEventId)) {
      throw new Error(
        `Invalid payload: edge ${edge.edgeId} references unknown source event ${edge.sourceEventId}.`,
      );
    }

    if (!eventIds.has(edge.targetEventId)) {
      throw new Error(
        `Invalid payload: edge ${edge.edgeId} references unknown target event ${edge.targetEventId}.`,
      );
    }

    if (edge.artifactId && !artifactIds.has(edge.artifactId)) {
      throw new Error(
        `Invalid payload: edge ${edge.edgeId} references unknown artifact ${edge.artifactId}.`,
      );
    }
  });

  payload.artifacts.forEach((artifact) => {
    if (!eventIds.has(artifact.producerEventId)) {
      throw new Error(
        `Invalid payload: artifact ${artifact.artifactId} references unknown producer event ${artifact.producerEventId}.`,
      );
    }
  });

  if (payload.run.selectedByDefaultId && !eventIds.has(payload.run.selectedByDefaultId)) {
    throw new Error(
      `Invalid payload: selectedByDefaultId references unknown event ${payload.run.selectedByDefaultId}.`,
    );
  }

  if (payload.run.finalArtifactId && !artifactIds.has(payload.run.finalArtifactId)) {
    throw new Error(
      `Invalid payload: finalArtifactId references unknown artifact ${payload.run.finalArtifactId}.`,
    );
  }
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

  const payload = {
    run: parsed.run as unknown as RawImportPayload["run"],
    lanes: lanes as unknown as RawImportPayload["lanes"],
    events: events as unknown as RawImportPayload["events"],
    edges: edges as unknown as RawImportPayload["edges"],
    artifacts: artifacts as unknown as RawImportPayload["artifacts"],
  };

  validatePayloadReferences(payload);

  return {
    project: parsed.project as unknown as RawImportPayload["project"],
    session: parsed.session as unknown as RawImportPayload["session"],
    ...payload,
  };
}
