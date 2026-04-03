import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/primitives";
import { SessionScoreDialogFooter } from "./SessionScoreDialogFooter";
import {
  SessionScoreFields,
} from "./SessionScoreEditorFields";
import { useSessionScoreEditorState } from "./sessionScoreEditorState";

export interface SessionScoreEditorDialogProps {
  initialNote: string | null;
  initialReviewer: string | null;
  initialScore: number | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { note: string | null; score: number; scoredBy: string }) => Promise<void>;
  open: boolean;
  pending: boolean;
  sessionTitle: string | null;
}

export function SessionScoreEditorDialog({
  initialNote,
  initialReviewer,
  initialScore,
  onOpenChange,
  onSave,
  open,
  pending,
  sessionTitle,
}: SessionScoreEditorDialogProps) {
  const form = useSessionScoreEditorState({
    initialNote,
    initialReviewer,
    initialScore,
    open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[rgb(14_18_28)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Score session</DialogTitle>
          <DialogDescription>
            {sessionTitle ?? "Review this session and save a score with a short note."}
          </DialogDescription>
        </DialogHeader>
        <SessionScoreFields
          note={form.note}
          noteId={form.noteId}
          reviewer={form.reviewer}
          reviewerId={form.reviewerId}
          score={form.score}
          scoreId={form.scoreId}
          setNote={form.setNote}
          setReviewer={form.setReviewer}
          setScore={form.setScore}
        />
        <SessionScoreDialogFooter
          disabled={form.saveDisabled || pending}
          onClose={() => onOpenChange(false)}
          onSave={() =>
            onSave({
              note: form.note.trim() || null,
              score: form.parsedScore,
              scoredBy: form.reviewer.trim(),
            })
          }
          pending={pending}
        />
      </DialogContent>
    </Dialog>
  );
}
