import { useState } from "react";
import { SessionScoreEditorDialog, useSessionScoreDetails } from "../../../features/session-scoring";
import { SessionScorePanelContent } from "./SessionScorePanelView";

interface SessionScorePanelProps {
  filePath: string | null;
  onScoreSaved: (filePath: string) => void;
  sessionTitle: string | null;
}

interface SessionScoreSaveInput {
  note: string | null;
  score: number;
  scoredBy: string;
}

function deriveSessionScoreDialogDefaults(
  record: ReturnType<typeof useSessionScoreDetails>["record"],
) {
  if (!record?.sessionScore) {
    return {
      initialNote: null,
      initialReviewer: null,
      initialScore: null,
    };
  }

  return {
    initialNote: record.sessionScore.note,
    initialReviewer: record.sessionScore.scoredBy,
    initialScore: record.sessionScore.score,
  };
}

function buildSessionScoreDialogProps(options: {
  pending: boolean;
  record: ReturnType<typeof useSessionScoreDetails>["record"];
  save: ReturnType<typeof useSessionScoreDetails>["save"];
  sessionTitle: string | null;
  setEditorOpen: (open: boolean) => void;
}) {
  const defaults = deriveSessionScoreDialogDefaults(options.record);

  return {
    ...defaults,
    onOpenChange: options.setEditorOpen,
    onSave: async (input: SessionScoreSaveInput) => {
      await options.save(input);
      options.setEditorOpen(false);
    },
    pending: options.pending,
    sessionTitle: options.sessionTitle,
  };
}

export function SessionScorePanel({
  filePath,
  onScoreSaved,
  sessionTitle,
}: SessionScorePanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const { error, loading, pending, record, revisions, save } = useSessionScoreDetails(
    filePath,
    onScoreSaved,
  );
  const dialogProps = buildSessionScoreDialogProps({
    pending,
    record,
    save,
    sessionTitle,
    setEditorOpen,
  });

  return (
    <>
      <SessionScorePanelContent
        error={error}
        filePath={filePath}
        loading={loading}
        onOpenEditor={() => setEditorOpen(true)}
        record={record}
        revisions={revisions}
      />
      <SessionScoreEditorDialog
        {...dialogProps}
        open={editorOpen}
      />
    </>
  );
}
