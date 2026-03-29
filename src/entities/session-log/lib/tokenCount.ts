import type {
  SessionEntrySnapshot,
  SessionLogSnapshot,
  SubagentSnapshot,
} from "../model/types";

interface TokenCountPayload {
  cached?: number;
  in?: number;
  out?: number;
  reasoning?: number;
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

export function resolveSessionSnapshotMaxContextWindowTokens(
  snapshot: Pick<SessionLogSnapshot, "entries" | "subagents">,
) {
  return resolveLatestTokenCountWindow([
    ...snapshot.entries,
    ...collectSubagentEntries(snapshot.subagents ?? []),
  ]);
}

function collectSubagentEntries(subagents: SubagentSnapshot[]) {
  return subagents.flatMap((subagent) => subagent.entries);
}

function resolveLatestTokenCountWindow(entries: SessionEntrySnapshot[]) {
  const tokenCountEntry = [...entries].reverse().find(resolveTokenCountEntry);
  return tokenCountEntry ? resolveTokenCountWindow(tokenCountEntry) : null;
}

function resolveTokenCountEntry(entry: SessionEntrySnapshot) {
  return entry.entryType === "token_count" && resolveTokenCountWindow(entry) !== null;
}

function resolveTokenCountWindow(
  entry: Pick<SessionEntrySnapshot, "text">,
) {
  const window = parseTokenCountPayload(entry.text)?.window;
  return typeof window === "number" && Number.isFinite(window) && window > 0 ? window : null;
}
