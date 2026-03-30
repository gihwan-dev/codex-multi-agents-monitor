export interface TokenUsageSnapshot {
  cached?: number;
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

export function parseTokenCountPayload(rawTokenCount: string | null) {
  if (!rawTokenCount) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawTokenCount) as TokenCountPayload;
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}
