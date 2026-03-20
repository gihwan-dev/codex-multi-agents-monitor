function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function assertTimestampRange(start: number, end: number, label: string) {
  if (end < start) {
    throw new Error(
      `Invalid payload: ${label} end timestamp must be greater than or equal to start timestamp.`,
    );
  }
}

export function assertStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (!isString(value) || !value.length) {
    throw new Error(`Invalid payload: ${key} must be a non-empty string.`);
  }
  return value;
}

export function assertNumberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!isNumber(value)) {
    throw new Error(`Invalid payload: ${key} must be a finite number.`);
  }
  return value;
}

export function assertOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined || value === null) {
    return value;
  }
  if (!isString(value)) {
    throw new Error(`Invalid payload: ${key} must be a string when provided.`);
  }
  return value;
}

export function assertEnumField<const T extends readonly string[]>(
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

export function assertArrayField(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Invalid payload: ${key} must be an array.`);
  }
  return value;
}
