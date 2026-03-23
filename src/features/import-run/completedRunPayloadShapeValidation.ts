import type { EdgeRecord, PromptAssembly, RawImportEvent, RawImportPayload } from "../../entities/run";
import {
  ARTIFACT_STRING_FIELDS,
  EDGE_STRING_FIELDS,
  EDGE_TYPES,
  EVENT_STRING_FIELDS,
  EVENT_TYPES,
  LANE_STRING_FIELDS,
  PROJECT_STRING_FIELDS,
  PROMPT_LAYER_STRING_FIELDS,
  RUN_ENUM_FIELDS,
  RUN_STATUSES,
  RUN_STRING_FIELDS,
  SESSION_STRING_FIELDS,
} from "./completedRunPayloadValidationFields";
import {
  assertArrayField,
  assertEnumField,
  assertNumberField,
  assertTimestampRange,
} from "./completedRunPayloadValidationPrimitives";
import {
  assertEnumFields,
  assertObjectEntry,
  assertObjectField,
  assertOptionalNumberField,
  assertOptionalStringField,
  assertStringFields,
} from "./completedRunPayloadValidationRecordHelpers";
import type { ValidatedCompletedRunPayload } from "./completedRunPayloadValidationTypes";

function validateRunPayload(record: Record<string, unknown>) {
  assertStringFields(record, RUN_STRING_FIELDS);
  assertEnumFields(record, RUN_ENUM_FIELDS);
  const startTs = assertNumberField(record, "startTs");
  validateOptionalEndTimestamp({ key: "endTs", label: "run", record, startTs });
  assertOptionalNumberField(record, "durationMs");
}

function validateProjectShape(record: Record<string, unknown>) {
  assertStringFields(record, PROJECT_STRING_FIELDS);
  assertOptionalStringField(record, "badge");
}

function validateSessionShape(record: Record<string, unknown>) {
  assertStringFields(record, SESSION_STRING_FIELDS);
  assertNumberField(record, "startedAt");
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

function validatePromptAssemblyLayerShape(value: unknown) {
  const record = assertObjectEntry(value, "promptAssembly layer");
  assertStringFields(record, PROMPT_LAYER_STRING_FIELDS);
  assertNumberField(record, "contentLength");
  assertOptionalStringField(record, "rawContent");
}

function validatePromptAssemblyShape(value: unknown): asserts value is PromptAssembly {
  const record = assertObjectEntry(value, "promptAssembly");
  const layers = assertArrayField(record, "layers");
  assertNumberField(record, "totalContentLength");
  layers.forEach(validatePromptAssemblyLayerShape);
}

export function validateCompletedRunPayloadShape(parsed: unknown): ValidatedCompletedRunPayload {
  const root = assertObjectEntry(parsed, "root");
  const sections = parseRootSections(root);
  validatePromptAssemblyIfPresent(root.promptAssembly);
  const collections = validatePayloadCollections(root);

  return buildValidatedPayload(root, sections, collections);
}

function validateOptionalEndTimestamp(options: {
  key: string;
  label: string;
  record: Record<string, unknown>;
  startTs: number;
}) {
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

function parseRootSections(root: Record<string, unknown>) {
  const project = assertObjectField(root, "project");
  const session = assertObjectField(root, "session");
  const run = assertObjectField(root, "run");

  validateProjectShape(project);
  validateSessionShape(session);
  validateRunPayload(run);

  return { project, run, session };
}

function validatePromptAssemblyIfPresent(promptAssembly: unknown) {
  if (promptAssembly !== undefined) {
    validatePromptAssemblyShape(promptAssembly);
  }
}

function collectPayloadCollections(root: Record<string, unknown>) {
  return {
    lanes: assertArrayField(root, "lanes"),
    events: assertArrayField(root, "events"),
    edges: assertArrayField(root, "edges"),
    artifacts: assertArrayField(root, "artifacts"),
  };
}

function assertRequiredPayloadCollections(collections: {
  lanes: unknown[];
  events: unknown[];
}) {
  if (!collections.lanes.length || !collections.events.length) {
    throw new Error("Invalid payload: lanes and events are required.");
  }
}

function validatePayloadCollectionEntries(collections: {
  lanes: unknown[];
  events: unknown[];
  edges: unknown[];
  artifacts: unknown[];
}) {
  collections.lanes.forEach(validateLaneShape);
  collections.events.forEach(validateEventShape);
  collections.edges.forEach(validateEdgeShape);
  collections.artifacts.forEach(validateArtifactShape);
}

function validatePayloadCollections(root: Record<string, unknown>) {
  const collections = collectPayloadCollections(root);
  assertRequiredPayloadCollections(collections);
  validatePayloadCollectionEntries(collections);
  return collections;
}

function buildValidatedPayload(
  root: Record<string, unknown>,
  sections: {
    project: Record<string, unknown>;
    run: Record<string, unknown>;
    session: Record<string, unknown>;
  },
  collections: {
    artifacts: unknown[];
    edges: unknown[];
    events: unknown[];
    lanes: unknown[];
  },
): ValidatedCompletedRunPayload {
  return {
    project: castValidatedValue<RawImportPayload["project"]>(sections.project),
    session: castValidatedValue<RawImportPayload["session"]>(sections.session),
    run: castValidatedValue<RawImportPayload["run"]>(sections.run),
    lanes: castValidatedValue<RawImportPayload["lanes"]>(collections.lanes),
    events: castValidatedValue<RawImportPayload["events"]>(collections.events),
    edges: castValidatedValue<RawImportPayload["edges"]>(collections.edges),
    artifacts: castValidatedValue<RawImportPayload["artifacts"]>(collections.artifacts),
    promptAssembly: castValidatedValue<RawImportPayload["promptAssembly"]>(root.promptAssembly),
  };
}
function castValidatedValue<T>(value: unknown): T { return value as T; }
