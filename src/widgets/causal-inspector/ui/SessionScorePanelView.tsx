import type { ProfileRevision, SessionScoreRecord } from "../../../entities/session-log";
import { Separator } from "../../../shared/ui/primitives";
import { ProfileSnapshotSummary, RevisionSummary } from "./SessionScorePanelContent";
import { SessionScorePanelHeader } from "./SessionScorePanelHeader";
import { SessionScorePanelSummary } from "./SessionScorePanelSummary";
import { SessionScoreSection } from "./SessionScoreSection";
import {
  deriveSessionScoreDisplay,
  resolveSessionScorePanelMessage,
} from "./sessionScorePanelViewModel";

function SessionScoreMessage({ message }: { message: string }) {
  return <p className="text-[0.8rem] text-muted-foreground">{message}</p>;
}

export function SessionScorePanelContent({
  error,
  filePath,
  loading,
  onOpenEditor,
  record,
  revisions,
}: {
  error: string | null;
  filePath: string | null;
  loading: boolean;
  onOpenEditor: () => void;
  record: SessionScoreRecord | null;
  revisions: ProfileRevision[];
}) {
  const message = resolveSessionScorePanelMessage({
    error,
    filePath,
    loading,
    record,
  });

  if (message || !record) {
    return (
      <SessionScoreMessage
        message={message ?? "Session scoring metadata is unavailable right now."}
      />
    );
  }

  const display = deriveSessionScoreDisplay(record);

  return (
    <div className="grid gap-3">
      <SessionScorePanelHeader
        onOpenEditor={onOpenEditor}
        recordLabel={display.profileLabel}
        score={display.score}
      />
      <SessionScorePanelSummary
        note={display.note}
        scoredAt={display.scoredAt}
        scoredBy={display.scoredBy}
      />
      <Separator className="bg-white/8" />
      <SessionScoreSection title="Profile snapshot">
        <ProfileSnapshotSummary record={record} />
      </SessionScoreSection>
      <SessionScoreSection title="Revision trend">
        <RevisionSummary
          currentRevision={record.profileSnapshot.revision}
          revisions={revisions}
        />
      </SessionScoreSection>
    </div>
  );
}
