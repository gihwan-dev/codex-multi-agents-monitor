import {
  EDGE_TYPES,
  type EdgeRecord,
  EVENT_TYPES,
  type PromptAssembly,
  type RawImportEvent,
  RUN_STATUSES,
} from "../../entities/run";
import {
  assertArrayField,
  assertEnumField,
  assertNumberField,
  assertTimestampRange,
} from "./completedRunPayloadValidationPrimitives";
import {
  assertObjectEntry,
  assertOptionalNumberField,
  assertOptionalStringField,
  assertStringFields,
} from "./completedRunPayloadValidationRecordHelpers";

const LANE_STRING_FIELDS = [
  "laneId",
  "agentId",
  "threadId",
  "name",
  "role",
  "model",
  "provider",
  "badge",
] as const;
const EDGE_STRING_FIELDS = [
  "edgeId",
  "sourceAgentId",
  "targetAgentId",
  "sourceEventId",
  "targetEventId",
] as const;
const ARTIFACT_STRING_FIELDS = [
  "artifactId",
  "title",
  "artifactRef",
  "producerEventId",
  "preview",
] as const;
const PROMPT_LAYER_STRING_FIELDS = ["layerId", "layerType", "label", "preview"] as const;
const EVENT_STRING_FIELDS = [
  "event_id",
  "lane_id",
  "agent_id",
  "thread_id",
  "title",
] as const;

export function validatePromptAssemblyIfPresent(promptAssembly: unknown) {
  if (promptAssembly !== undefined) {
    validatePromptAssemblyShape(promptAssembly);
  }
}

export function validatePayloadCollections(root: Record<string, unknown>) {
  const collections = readPayloadCollections(root);
  assertRequiredCollections(collections);
  validateCollectionEntries(collections);

  return collections;
}

function readPayloadCollections(root: Record<string, unknown>) {
  return {
    artifacts: assertArrayField(root, "artifacts"),
    edges: assertArrayField(root, "edges"),
    events: assertArrayField(root, "events"),
    lanes: assertArrayField(root, "lanes"),
  };
}

function assertRequiredCollections(collections: {
  events: unknown[];
  lanes: unknown[];
}) {
  if (!collections.lanes.length || !collections.events.length) {
    throw new Error("Invalid payload: lanes and events are required.");
  }
}

function validateCollectionEntries(collections: {
  artifacts: unknown[];
  edges: unknown[];
  events: unknown[];
  lanes: unknown[];
}) {
  collections.lanes.forEach(validateLaneShape);
  collections.events.forEach(validateEventShape);
  collections.edges.forEach(validateEdgeShape);
  collections.artifacts.forEach(validateArtifactShape);
}

function validateLaneShape(value: unknown) {
  const record = assertObjectEntry(value, "lane");
  assertStringFields(record, LANE_STRING_FIELDS);
  assertEnumField(record, "laneStatus", RUN_STATUSES);
}

function validateEventShape(value: unknown): asserts value is RawImportEvent {
  const record = assertObjectEntry(value, "event");
  assertStringFields(record, EVENT_STRING_FIELDS);
  assertEnumField(record, "event_type", EVENT_TYPES);
  const status = assertEnumField(record, "status", RUN_STATUSES);
  const startTs = assertNumberField(record, "start_ts");
  validateOptionalEndTimestamp({
    key: "end_ts",
    label: `event ${record.event_id}`,
    record,
    startTs,
  });
  assertOptionalNumberField(record, "retry_count");
  validateRequiredWaitReason(record, status);
}

function validateEdgeShape(value: unknown): asserts value is EdgeRecord {
  const record = assertObjectEntry(value, "edge");
  assertStringFields(record, EDGE_STRING_FIELDS);
  assertEnumField(record, "edgeType", EDGE_TYPES);
  assertOptionalStringField(record, "payloadPreview");
}

function validateArtifactShape(value: unknown) {
  const record = assertObjectEntry(value, "artifact");
  assertStringFields(record, ARTIFACT_STRING_FIELDS);
  assertOptionalStringField(record, "rawContent");
}

function validatePromptAssemblyShape(value: unknown): asserts value is PromptAssembly {
  const record = assertObjectEntry(value, "promptAssembly");
  const layers = assertArrayField(record, "layers");
  assertNumberField(record, "totalContentLength");
  layers.forEach(validatePromptAssemblyLayerShape);
}

function validatePromptAssemblyLayerShape(value: unknown) {
  const record = assertObjectEntry(value, "promptAssembly layer");
  assertStringFields(record, PROMPT_LAYER_STRING_FIELDS);
  assertNumberField(record, "contentLength");
  assertOptionalStringField(record, "rawContent");
}

function validateOptionalEndTimestamp(
  options: {
    key: string;
    label: string;
    record: Record<string, unknown>;
    startTs: number;
  },
) {
  const { key, label, record, startTs } = options;
  if (record[key] !== undefined && record[key] !== null) {
    const endTs = assertNumberField(record, key);
    assertTimestampRange(startTs, endTs, label);
  }
}

function validateRequiredWaitReason(
  record: Record<string, unknown>,
  status: RawImportEvent["status"],
) {
  if (
    ["waiting", "blocked", "interrupted"].includes(status) &&
    typeof record.wait_reason !== "string"
  ) {
    throw new Error(`Invalid payload: wait_reason required for ${record.event_id}.`);
  }
}
