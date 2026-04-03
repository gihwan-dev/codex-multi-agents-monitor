export interface TokenUsageSnapshot {
  cached?: number;
  cacheWrite?: number;
  in?: number;
  out?: number;
  reasoning?: number;
  total?: number;
}

export interface TokenCountPayload {
  last?: TokenUsageSnapshot;
  total?: TokenUsageSnapshot;
  window?: number | null;
}

const TOKEN_USAGE_KEYS = [
  "cached",
  "cacheWrite",
  "in",
  "out",
  "reasoning",
  "total",
] as const;

export function parseTokenCountPayload(rawTokenCount: string | null) {
  if (!rawTokenCount) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawTokenCount) as unknown;
    return normalizeTokenCountPayload(parsed);
  } catch {
    return null;
  }
}

function normalizeTokenCountPayload(parsed: unknown): TokenCountPayload | null {
  if (!isRecord(parsed)) {
    return null;
  }

  const normalizedContent = {
    nestedLast: resolveNestedTokenUsageSnapshot(parsed, "last"),
    nestedTotal: resolveNestedTokenUsageSnapshot(parsed, "total"),
    window: resolveWindowValue(parsed.window),
  };
  const legacyLast = normalizedContent.nestedLast
    ? undefined
    : normalizeTokenUsageSnapshot(parsed);

  if (!hasNormalizedTokenCountContent({ ...normalizedContent, legacyLast })) {
    return null;
  }

  return buildTokenCountPayload(normalizedContent, legacyLast);
}

function resolveNestedTokenUsageSnapshot(
  parsed: Record<string, unknown>,
  key: "last" | "total",
) {
  return normalizeTokenUsageSnapshot(parsed[key]);
}

function normalizeTokenUsageSnapshot(value: unknown): TokenUsageSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const snapshot: TokenUsageSnapshot = {
    ...readCacheWriteSnapshot(value),
  };
  assignNumericTokenUsage(snapshot, value);

  return hasTokenUsageSnapshot(snapshot) ? snapshot : undefined;
}

function resolveWindowValue(value: unknown): number | null | undefined {
  if (typeof value === "number" || value === null) {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCacheWriteSnapshot(value: Record<string, unknown>) {
  return typeof value.cache_write === "number"
    ? { cacheWrite: value.cache_write }
    : {};
}

function assignNumericTokenUsage(
  snapshot: TokenUsageSnapshot,
  value: Record<string, unknown>,
) {
  for (const key of TOKEN_USAGE_KEYS) {
    const tokenValue = value[key];
    if (typeof tokenValue === "number") {
      snapshot[key] = tokenValue;
    }
  }
}

function buildTokenCountPayload(
  normalizedContent: {
    nestedLast: TokenUsageSnapshot | undefined;
    nestedTotal: TokenUsageSnapshot | undefined;
    window: number | null | undefined;
  },
  legacyLast: TokenUsageSnapshot | undefined,
) {
  return {
    ...(normalizedContent.nestedLast || legacyLast
      ? { last: normalizedContent.nestedLast ?? legacyLast }
      : {}),
    ...(normalizedContent.nestedTotal ? { total: normalizedContent.nestedTotal } : {}),
    ...(normalizedContent.window !== undefined
      ? { window: normalizedContent.window }
      : {}),
  };
}

function hasNormalizedTokenCountContent(
  content: {
    nestedLast: TokenUsageSnapshot | undefined;
    nestedTotal: TokenUsageSnapshot | undefined;
    legacyLast: TokenUsageSnapshot | undefined;
    window: number | null | undefined;
  },
) {
  return Boolean(
    content.nestedLast ||
      content.nestedTotal ||
      content.legacyLast ||
      content.window !== undefined,
  );
}

function hasTokenUsageSnapshot(snapshot: TokenUsageSnapshot) {
  return TOKEN_USAGE_KEYS.some((key) => snapshot[key] !== undefined);
}
