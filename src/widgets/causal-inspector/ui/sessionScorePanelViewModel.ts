import type { SessionScoreRecord } from "../../../entities/session-log";

export interface SessionScoreDisplay {
  note: string | null;
  profileLabel: string;
  score: number | null;
  scoredAt: string | null;
  scoredBy: string | null;
}

export function deriveSessionScoreDisplay(record: SessionScoreRecord): SessionScoreDisplay {
  if (!record.sessionScore) {
    return {
      note: null,
      profileLabel: record.profileSnapshot.label,
      score: null,
      scoredAt: null,
      scoredBy: null,
    };
  }

  return {
    note: record.sessionScore.note,
    profileLabel: record.profileSnapshot.label,
    score: record.sessionScore.score,
    scoredAt: record.sessionScore.scoredAt,
    scoredBy: record.sessionScore.scoredBy,
  };
}

export function resolveSessionScorePanelMessage(options: {
  error: string | null;
  filePath: string | null;
  loading: boolean;
  record: SessionScoreRecord | null;
}) {
  if (!options.filePath) {
    return "Select a stored session to review its score and profile snapshot.";
  }
  if (options.loading) {
    return "Loading scoring metadata…";
  }
  if (options.error) {
    return options.error;
  }
  return options.record
    ? null
    : "Session scoring metadata is unavailable right now.";
}
