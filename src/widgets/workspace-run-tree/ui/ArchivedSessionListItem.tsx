import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { cn } from "../../../shared/lib";
import {
  deriveArchivedSessionTitle,
  formatArchivedSessionDate,
} from "../lib/archivedSessionPresentation";

interface ArchivedSessionListItemProps {
  activeFilePath: string | null;
  onSelect: (filePath: string) => void;
  session: ArchivedSessionIndexItem;
}

export function ArchivedSessionListItem({
  activeFilePath,
  onSelect,
  session,
}: ArchivedSessionListItemProps) {
  return (
    <button
      type="button"
      data-slot="archive-session-item"
      data-file-path={session.filePath}
      data-active={activeFilePath === session.filePath ? "true" : "false"}
      className={cn(
        "grid min-w-0 gap-1 rounded-md px-2 py-1.5 text-left text-[0.8rem] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
        activeFilePath === session.filePath &&
          "bg-[color:color-mix(in_srgb,var(--color-active)_8%,transparent)] text-foreground",
      )}
      onClick={() => onSelect(session.filePath)}
      title={session.workspacePath}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate">{deriveArchivedSessionTitle(session)}</span>
        {session.model ? (
          <span className="shrink-0 text-[0.72rem] text-[var(--color-text-tertiary)]">
            {session.model}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-[0.72rem] text-[var(--color-text-tertiary)]">
        <span>{formatArchivedSessionDate(session.startedAt)}</span>
        <span>{session.sessionId.slice(0, 8)}</span>
      </div>
    </button>
  );
}
