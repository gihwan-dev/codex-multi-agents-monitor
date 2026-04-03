import type { CandidateRun } from "../../../entities/eval";

interface EvalRunNotesSectionProps {
  run: CandidateRun;
}

export function EvalRunNotesSection({ run }: EvalRunNotesSectionProps) {
  if (run.notes.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-foreground">Notes</span>
      <ul className="grid gap-2 text-sm text-foreground/90">
        {run.notes.map((note) => (
          <li
            key={note}
            className="rounded-[var(--radius-soft)] border border-white/8 bg-black/10 px-3 py-2"
          >
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}
