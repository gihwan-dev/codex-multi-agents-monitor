import type {
  ProfileRevision,
  SaveSessionScoreInput,
  SessionScoreRecord,
} from "../../../entities/session-log";
import { invokeTauri } from "../../../shared/api";

export async function loadSessionScoreRecord(
  filePath: string,
): Promise<SessionScoreRecord | null> {
  const records = await invokeTauri<SessionScoreRecord[]>("load_session_scores", {
    query: { filePath },
  });
  return records[0] ?? null;
}

export function loadProfileRevisions(
  workspacePath: string,
): Promise<ProfileRevision[]> {
  return invokeTauri<ProfileRevision[]>("load_profile_revisions", {
    query: { workspacePath },
  });
}

export function saveSessionScore(
  input: SaveSessionScoreInput,
): Promise<SessionScoreRecord> {
  return invokeTauri<SessionScoreRecord>("save_session_score", { input });
}
