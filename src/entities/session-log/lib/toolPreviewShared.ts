type JsonRecord = Record<string, unknown>;

export interface AgentReference {
  agentId: string | null;
  nickname: string | null;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

export function parseJsonRecord(
  value: string | null | undefined,
): JsonRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readAgentReference(record: JsonRecord | null): AgentReference {
  return {
    agentId: readStringValue(record, "agent_id", "agentId"),
    nickname: readStringValue(record, "nickname", "agent_nickname"),
  };
}

export function readStringArray(options: {
  record: JsonRecord | null;
  key: string;
}): string[] {
  const value = options.record?.[options.key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readStringValue(
  record: JsonRecord | null,
  primaryKey: string,
  secondaryKey: string,
): string | null {
  if (typeof record?.[primaryKey] === "string") {
    return record[primaryKey] as string;
  }

  return typeof record?.[secondaryKey] === "string"
    ? (record[secondaryKey] as string)
    : null;
}
