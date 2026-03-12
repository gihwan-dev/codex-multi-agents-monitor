import type {
  LiveSessionUpdate,
  SessionSummary,
  WorkspaceSessionGroup,
  WorkspaceSessionsSnapshot,
} from "@/shared/queries";

export function compareSessionSummary(left: SessionSummary, right: SessionSummary) {
  const leftTimestamp = left.last_event_at ?? "";
  const rightTimestamp = right.last_event_at ?? "";

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }

  return left.session_id.localeCompare(right.session_id);
}

export function sortWorkspaceGroup(
  group: WorkspaceSessionGroup,
): WorkspaceSessionGroup {
  return {
    ...group,
    sessions: [...group.sessions].sort(compareSessionSummary),
  };
}

export function sortSnapshot(
  snapshot: WorkspaceSessionsSnapshot,
): WorkspaceSessionsSnapshot {
  return {
    refreshed_at: snapshot.refreshed_at,
    workspaces: [...snapshot.workspaces]
      .map(sortWorkspaceGroup)
      .sort((left, right) => left.workspace_path.localeCompare(right.workspace_path)),
  };
}

export function upsertSessionSummary(
  current: WorkspaceSessionsSnapshot | null,
  summary: SessionSummary,
  refreshedAt: string,
) {
  const seed = current ?? { refreshed_at: refreshedAt, workspaces: [] };
  const stripped = seed.workspaces
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => session.session_id !== summary.session_id),
    }))
    .filter(
      (group) => group.sessions.length > 0 || group.workspace_path === summary.workspace_path,
    );
  const targetIndex = stripped.findIndex(
    (group) => group.workspace_path === summary.workspace_path,
  );

  if (targetIndex >= 0) {
    stripped[targetIndex] = {
      ...stripped[targetIndex],
      sessions: [...stripped[targetIndex].sessions, summary],
    };
  } else {
    stripped.push({
      workspace_path: summary.workspace_path,
      sessions: [summary],
    });
  }

  return sortSnapshot({
    refreshed_at: refreshedAt,
    workspaces: stripped,
  });
}

export function upsertLiveSummary(
  current: WorkspaceSessionsSnapshot | null,
  update: LiveSessionUpdate,
) {
  return upsertSessionSummary(current, update.summary, update.refreshed_at);
}

export function mergeBootstrapSnapshot(
  bootstrapSnapshot: WorkspaceSessionsSnapshot,
  liveSnapshot: WorkspaceSessionsSnapshot | null,
) {
  let merged = sortSnapshot(bootstrapSnapshot);

  if (!liveSnapshot) {
    return merged;
  }

  for (const workspace of liveSnapshot.workspaces) {
    for (const session of workspace.sessions) {
      merged = upsertSessionSummary(merged, session, liveSnapshot.refreshed_at);
    }
  }

  return merged;
}

export function firstSessionId(snapshot: WorkspaceSessionsSnapshot | null) {
  return snapshot?.workspaces[0]?.sessions[0]?.session_id ?? null;
}

export function findSelectedSession(
  snapshot: WorkspaceSessionsSnapshot | null,
  sessionId: string | null,
) {
  if (!snapshot || !sessionId) {
    return null;
  }

  for (const workspace of snapshot.workspaces) {
    for (const session of workspace.sessions) {
      if (session.session_id === sessionId) {
        return session;
      }
    }
  }

  return null;
}
