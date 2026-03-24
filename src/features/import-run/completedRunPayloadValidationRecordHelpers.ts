import {
  assertEnumField,
  assertNumberField,
  assertOptionalString,
  assertStringField,
  isRecord,
} from "./completedRunPayloadValidationPrimitives";

type EnumValues = readonly string[];

export function assertObjectEntry(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Invalid payload: ${label} entry must be an object.`);
  }

  return value;
}

export function assertObjectField(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`Invalid payload: ${key} is required.`);
  }

  return value;
}

export function assertStringFields(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    assertStringField(record, key);
  }
}

export function assertEnumFields(
  record: Record<string, unknown>,
  entries: ReadonlyArray<readonly [string, EnumValues]>,
) {
  for (const [key, values] of entries) {
    assertEnumField(record, key, values);
  }
}

export function assertOptionalNumberField(
  record: Record<string, unknown>,
  key: string,
) {
  if (record[key] !== undefined) {
    assertNumberField(record, key);
  }
}

export function assertOptionalStringField(
  record: Record<string, unknown>,
  key: string,
) {
  if (record[key] !== undefined && record[key] !== null) {
    assertOptionalString(record, key);
  }
}
