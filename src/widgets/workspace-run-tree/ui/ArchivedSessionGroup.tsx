import { ChevronRight } from "lucide-react";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { cn } from "../../../shared/lib";
import { resolveProviderBadge } from "../lib/providerBadge";
import {
  deriveArchiveItemTitle,
  formatArchiveDate,
} from "./ArchivedSessionPresentation";

function ArchiveSessionItem({
  activeFilePath,
  onSelect,
  session,
}: {
  activeFilePath: string | null;
  onSelect: (filePath: string) => void;
  session: ArchivedSessionIndexItem;
}) {
  const providerBadge = resolveProviderBadge(session.provider);
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
        <span className="min-w-0 flex-1 truncate">{deriveArchiveItemTitle(session)}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {providerBadge ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
                providerBadge.className,
              )}
              title={providerBadge.label}
            >
              {providerBadge.short}
            </span>
          ) : null}
          {session.model ? (
            <span className="text-[0.72rem] text-[var(--color-text-tertiary)]">
              {session.model}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[0.72rem] text-[var(--color-text-tertiary)]">
        <span>{formatArchiveDate(session.startedAt)}</span>
        <span>{session.sessionId.slice(0, 8)}</span>
      </div>
    </button>
  );
}

export function ArchivedWorkspaceGroupSection({
  activeFilePath,
  expanded,
  onSelect,
  onToggle,
  sessions,
  title,
  workspaceKey,
}: {
  activeFilePath: string | null;
  expanded: boolean;
  onSelect: (filePath: string) => void;
  onToggle: () => void;
  sessions: ArchivedSessionIndexItem[];
  title: string;
  workspaceKey: string;
}) {
  return (
    <section
      data-slot="archive-workspace-group"
      data-workspace-key={workspaceKey}
      className="grid gap-1 border-b border-white/6 pb-2"
    >
      <button
        type="button"
        data-slot="archive-workspace-toggle"
        className="flex min-h-7 min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-[0.78rem] text-muted-foreground transition-colors hover:bg-white/[0.03]"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={cn("size-3 transition-transform", expanded && "rotate-90")}
          aria-hidden="true"
        />
        <span data-slot="archive-workspace-name" className="min-w-0 flex-1 truncate" title={title}>
          {title}
        </span>
        <span className="text-[0.7rem] text-[var(--color-text-tertiary)]">{sessions.length}</span>
      </button>
      {expanded ? (
        <div className="ml-2 min-w-0 grid gap-1 border-l border-white/8 pl-3">
          {sessions.map((session) => (
            <ArchiveSessionItem
              key={session.filePath}
              activeFilePath={activeFilePath}
              onSelect={onSelect}
              session={session}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
