import { useCallback, useEffect, useState } from "react";
import type { ProfileRevision, SessionScoreRecord } from "../../../entities/session-log";
import {
  persistSessionScore,
  resetSessionScoreLoader,
  type SaveSessionScoreValues,
  startSessionScoreSave,
  throwSessionScoreSaveFailure,
  watchSessionScoreLoader,
} from "./sessionScoreDetailsHelpers";

function useSessionScoreState() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [record, setRecord] = useState<SessionScoreRecord | null>(null);
  const [revisions, setRevisions] = useState<ProfileRevision[]>([]);

  return {
    error,
    loading,
    pending,
    record,
    revisions,
    setError,
    setLoading,
    setPending,
    setRecord,
    setRevisions,
  };
}

function useSessionScoreLoader(
  filePath: string | null,
  state: ReturnType<typeof useSessionScoreState>,
) {
  const { setError, setLoading, setRecord, setRevisions } = state;

  useEffect(() => {
    if (!filePath) {
      return resetSessionScoreLoader({ setError, setLoading, setRecord, setRevisions });
    }

    return watchSessionScoreLoader(filePath, {
      setError,
      setLoading,
      setRecord,
      setRevisions,
    });
  }, [filePath, setError, setLoading, setRecord, setRevisions]);
}

function useSessionScoreSave(
  filePath: string | null,
  onScoreSaved: (filePath: string) => void,
  state: ReturnType<typeof useSessionScoreState>,
) {
  const { setError, setPending, setRecord, setRevisions } = state;

  return useCallback(
    async (values: SaveSessionScoreValues) => {
      if (!filePath) {
        return;
      }

      startSessionScoreSave({ setError, setPending });

      try {
        await persistSessionScore({
          filePath,
          onScoreSaved,
          setRecord,
          setRevisions,
          values,
        });
      } catch {
        throwSessionScoreSaveFailure(setError);
      } finally {
        setPending(false);
      }
    },
    [filePath, onScoreSaved, setError, setPending, setRecord, setRevisions],
  );
}

export function useSessionScoreDetails(
  filePath: string | null,
  onScoreSaved: (filePath: string) => void,
) {
  const state = useSessionScoreState();
  useSessionScoreLoader(filePath, state);
  const save = useSessionScoreSave(filePath, onScoreSaved, state);

  return {
    error: state.error,
    loading: state.loading,
    pending: state.pending,
    record: state.record,
    revisions: state.revisions,
    save,
  };
}
