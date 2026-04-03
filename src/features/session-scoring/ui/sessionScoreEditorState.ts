import { useEffect, useId, useState } from "react";

function syncSessionScoreFormState(options: {
  initialNote: string | null;
  initialReviewer: string | null;
  initialScore: number | null;
  setNote: (value: string) => void;
  setReviewer: (value: string) => void;
  setScore: (value: string) => void;
}) {
  options.setScore(options.initialScore?.toString() ?? "");
  options.setNote(options.initialNote ?? "");
  options.setReviewer(options.initialReviewer ?? "");
}

function useSessionScoreFormState(options: {
  initialNote: string | null;
  initialReviewer: string | null;
  initialScore: number | null;
  open: boolean;
}) {
  const { initialNote, initialReviewer, initialScore, open } = options;
  const [score, setScore] = useState(initialScore?.toString() ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [reviewer, setReviewer] = useState(initialReviewer ?? "");

  useEffect(() => {
    if (!open) {
      return;
    }

    syncSessionScoreFormState({
      initialNote,
      initialReviewer,
      initialScore,
      setNote,
      setReviewer,
      setScore,
    });
  }, [initialNote, initialReviewer, initialScore, open]);

  return {
    note,
    reviewer,
    score,
    setNote,
    setReviewer,
    setScore,
  };
}

export function useSessionScoreEditorState(options: {
  initialNote: string | null;
  initialReviewer: string | null;
  initialScore: number | null;
  open: boolean;
}) {
  const idBase = useId();
  const { note, reviewer, score, setNote, setReviewer, setScore } =
    useSessionScoreFormState(options);
  const parsedScore = Number(score);

  return {
    note,
    noteId: `${idBase}-note`,
    parsedScore,
    reviewer,
    reviewerId: `${idBase}-reviewer`,
    saveDisabled:
      !Number.isFinite(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100 ||
      reviewer.trim().length === 0,
    score,
    scoreId: `${idBase}-score`,
    setNote,
    setReviewer,
    setScore,
  };
}
