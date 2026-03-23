import type { ArchivedSessionIndexItem } from "../../../entities/session-log";

export interface ArchivedWorkspaceGroup {
  key: string;
  displayName: string;
  sessions: ArchivedSessionIndexItem[];
}

function resolveWorkspaceGroupKey(item: ArchivedSessionIndexItem) {
  return item.originPath || item.workspacePath || item.displayName;
}

function appendSessionToWorkspaceGroup(
  map: Map<string, ArchivedWorkspaceGroup>,
  item: ArchivedSessionIndexItem,
) {
  const key = resolveWorkspaceGroupKey(item);
  const existing = map.get(key);
  if (existing) {
    existing.sessions.push(item);
    return;
  }

  map.set(key, {
    key,
    displayName: item.displayName,
    sessions: [item],
  });
}

export function groupArchivedSessionsByWorkspace(
  items: ArchivedSessionIndexItem[],
): ArchivedWorkspaceGroup[] {
  const map = new Map<string, ArchivedWorkspaceGroup>();

  for (const item of items) {
    appendSessionToWorkspaceGroup(map, item);
  }

  return Array.from(map.values());
}
