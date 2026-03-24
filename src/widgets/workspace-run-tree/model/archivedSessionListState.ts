export function isArchivedSessionSearchPending(localSearch: string, search: string) {
  return localSearch.trim() !== search.trim();
}

export function toggleArchivedSessionGroup(
  expandedGroups: Set<string>,
  groupKey: string,
) {
  const next = new Set(expandedGroups);
  if (next.has(groupKey)) {
    next.delete(groupKey);
    return next;
  }

  next.add(groupKey);
  return next;
}
