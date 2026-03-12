import type {
  CanonicalSessionBundle,
  SessionStatus,
  SourceKind,
} from "./canonical";

export interface SessionSummary {
  session_id: string;
  workspace_path: string;
  title: string | null;
  status: SessionStatus;
  source_kind: SourceKind;
  is_archived: boolean;
  started_at: string;
  ended_at: string | null;
  last_event_at: string | null;
  event_count: number;
}

export interface WorkspaceSessionGroup {
  workspace_path: string;
  sessions: SessionSummary[];
}

export interface WorkspaceSessionsSnapshot {
  refreshed_at: string;
  workspaces: WorkspaceSessionGroup[];
}

export interface SessionDetailQuery {
  session_id: string;
}

export interface SessionDetailSnapshot {
  bundle: CanonicalSessionBundle;
  last_event_at: string | null;
  event_count: number;
}

export interface LiveSessionUpdate {
  refreshed_at: string;
  summary: SessionSummary;
}
