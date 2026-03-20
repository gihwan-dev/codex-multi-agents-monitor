import type {
  SessionEntrySnapshot,
  SubagentSnapshot,
  TimedSubagentSnapshot,
} from "../model/types";

export function parseRequiredTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildTimedSubagentSnapshots(
  subagents: SubagentSnapshot[],
): TimedSubagentSnapshot[] {
  return subagents.flatMap((subagent) => {
    const startedTs = parseRequiredTimestamp(subagent.startedAt);
    const updatedAtTs = parseRequiredTimestamp(subagent.updatedAt);
    if (startedTs === null || updatedAtTs === null) {
      return [];
    }

    return [
      {
        ...subagent,
        startedTs,
        updatedTs: Math.max(updatedAtTs, startedTs),
      },
    ];
  });
}

export function buildEntryEventId(
  threadId: string,
  entry: Pick<SessionEntrySnapshot, "timestamp" | "entryType">,
  index: number,
) {
  return `${threadId}:${entry.timestamp}:${entry.entryType}:${index}`;
}
