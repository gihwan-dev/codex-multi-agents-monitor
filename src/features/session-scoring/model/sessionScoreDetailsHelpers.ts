import type { ProfileRevision, SessionScoreRecord } from "../../../entities/session-log";
import {
  loadProfileRevisions,
  loadSessionScoreRecord,
  saveSessionScore,
} from "../api/tauriSessionScoring";

export interface SaveSessionScoreValues {
  note: string | null;
  score: number;
  scoredBy: string;
}

export interface SessionScoreStateSetters {
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setPending: (value: boolean) => void;
  setRecord: (value: SessionScoreRecord | null) => void;
  setRevisions: (value: ProfileRevision[]) => void;
}

async function loadSessionScoreState(filePath: string) {
  const record = await loadSessionScoreRecord(filePath);
  const revisions = record?.workspacePath
    ? await loadProfileRevisions(record.workspacePath)
    : [];

  return {
    record,
    revisions,
  };
}

export function resetSessionScoreState(options: Pick<
  SessionScoreStateSetters,
  "setError" | "setLoading" | "setRecord" | "setRevisions"
>) {
  options.setError(null);
  options.setLoading(false);
  options.setRecord(null);
  options.setRevisions([]);
}

export function resetSessionScoreLoader(
  options: Parameters<typeof resetSessionScoreState>[0],
) {
  resetSessionScoreState(options);
  return () => {};
}

function applyLoadedSessionScoreState(
  active: boolean,
  nextState: Awaited<ReturnType<typeof loadSessionScoreState>>,
  setters: Pick<SessionScoreStateSetters, "setRecord" | "setRevisions">,
) {
  if (!active) {
    return;
  }

  setters.setRecord(nextState.record);
  setters.setRevisions(nextState.revisions);
}

function applyFailedSessionScoreState(
  active: boolean,
  setters: Pick<SessionScoreStateSetters, "setError" | "setRecord" | "setRevisions">,
) {
  if (!active) {
    return;
  }

  setters.setError("Session scoring metadata is unavailable right now.");
  setters.setRecord(null);
  setters.setRevisions([]);
}

function finishSessionScoreLoad(
  setLoading: SessionScoreStateSetters["setLoading"],
) {
  setLoading(false);
}

export function watchSessionScoreLoader(
  filePath: string,
  setters: Pick<
    SessionScoreStateSetters,
    "setError" | "setLoading" | "setRecord" | "setRevisions"
  >,
) {
  let active = true;

  setters.setError(null);
  setters.setLoading(true);

  loadSessionScoreState(filePath)
    .then((nextState) => applyLoadedSessionScoreState(active, nextState, setters))
    .catch(() => applyFailedSessionScoreState(active, setters))
    .finally(() => finishSessionScoreLoad(setters.setLoading));

  return () => {
    active = false;
  };
}

export async function persistSessionScore(options: {
  filePath: string;
  onScoreSaved: (filePath: string) => void;
  setRecord: SessionScoreStateSetters["setRecord"];
  setRevisions: SessionScoreStateSetters["setRevisions"];
  values: SaveSessionScoreValues;
}) {
  const nextRecord = await saveSessionScore({
    filePath: options.filePath,
    note: options.values.note,
    score: options.values.score,
    scoredAt: new Date().toISOString(),
    scoredBy: options.values.scoredBy,
  });

  options.setRecord(nextRecord);
  options.setRevisions(await loadProfileRevisions(nextRecord.workspacePath));
  options.onScoreSaved(options.filePath);
}

export function startSessionScoreSave(options: Pick<
  SessionScoreStateSetters,
  "setError" | "setPending"
>) {
  options.setPending(true);
  options.setError(null);
}
