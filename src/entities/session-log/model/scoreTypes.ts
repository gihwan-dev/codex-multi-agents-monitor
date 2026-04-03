import type { SessionProvider } from "./types";

export interface SessionScore {
  score: number;
  note: string | null;
  scoredAt: string;
  scoredBy: string;
}

export interface ProfileAgentSnapshot {
  provider: SessionProvider;
  role: string;
  model: string | null;
}

export interface ProfileSnapshot {
  revision: string;
  label: string;
  provider: SessionProvider;
  mainModel: string | null;
  guidanceHash: string | null;
  subagents: ProfileAgentSnapshot[];
}

export interface ProfileRevision {
  revision: string;
  label: string;
  sessionCount: number;
  averageScore: number | null;
}

export interface SessionScoreRecord {
  provider: SessionProvider;
  sessionId: string;
  filePath: string;
  workspacePath: string;
  sessionScore: SessionScore | null;
  profileSnapshot: ProfileSnapshot;
}

export interface SaveSessionScoreInput {
  filePath: string;
  score: number;
  note: string | null;
  scoredAt: string;
  scoredBy: string;
}

export interface LoadSessionScoresQuery {
  filePath?: string;
  workspacePath?: string;
  profileRevision?: string;
  minScore?: number;
  sortBy?: "score" | "scoredAt";
  sortDirection?: "asc" | "desc";
}
