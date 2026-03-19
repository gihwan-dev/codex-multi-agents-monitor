import type { ArchivedSessionIndexItem } from "../../shared/domain";

export interface ArchivedWorkspaceGroup {
  key: string;
  displayName: string;
  sessions: ArchivedSessionIndexItem[];
}

export function groupArchivedSessionsByWorkspace(
  items: ArchivedSessionIndexItem[],
): ArchivedWorkspaceGroup[] {
  const map = new Map<string, ArchivedWorkspaceGroup>();

  for (const item of items) {
    const key = item.originPath || item.workspacePath || item.displayName;
    const existing = map.get(key);
    if (existing) {
      existing.sessions.push(item);
      continue;
    }

    map.set(key, {
      key,
      displayName: item.displayName,
      sessions: [item],
    });
  }

  return Array.from(map.values());
}
