import type { ReactNode } from "react";
import {
  Input,
  Textarea,
} from "../../../shared/ui/primitives";

function SessionScoreField({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[0.78rem] font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function SessionScoreFields({
  note,
  noteId,
  reviewer,
  reviewerId,
  score,
  scoreId,
  setNote,
  setReviewer,
  setScore,
}: {
  note: string;
  noteId: string;
  reviewer: string;
  reviewerId: string;
  score: string;
  scoreId: string;
  setNote: (value: string) => void;
  setReviewer: (value: string) => void;
  setScore: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <SessionScoreField htmlFor={scoreId} label="Score">
        <Input
          id={scoreId}
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(event) => setScore(event.target.value)}
          className="border-white/10 bg-white/[0.03]"
        />
      </SessionScoreField>
      <SessionScoreField htmlFor={reviewerId} label="Reviewer">
        <Input
          id={reviewerId}
          value={reviewer}
          onChange={(event) => setReviewer(event.target.value)}
          className="border-white/10 bg-white/[0.03]"
          placeholder="Who is scoring this session?"
        />
      </SessionScoreField>
      <SessionScoreField htmlFor={noteId} label="Review note">
        <Textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-28 border-white/10 bg-white/[0.03]"
          placeholder="What worked, what regressed, and what this profile changed."
        />
      </SessionScoreField>
    </div>
  );
}
