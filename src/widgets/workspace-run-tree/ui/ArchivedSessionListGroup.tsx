import { ChevronRight } from "lucide-react";
import { cn } from "../../../shared/lib";
import type { ArchivedWorkspaceGroup } from "../lib/archiveGroups";
import { ArchivedSessionListItem } from "./ArchivedSessionListItem";

interface ArchivedSessionListGroupProps {
  activeFilePath: string | null;
  expanded: boolean;
  group: ArchivedWorkspaceGroup;
  onSelect: (filePath: string) => void;
  onToggleGroup: (groupKey: string) => void;
}

export function ArchivedSessionListGroup({
  activeFilePath,
  expanded,
  group,
  onSelect,
  onToggleGroup,
}: ArchivedSessionListGroupProps) {
  return (
    <section
      data-slot="archive-workspace-group"
      data-workspace-key={group.key}
      className="grid gap-1 border-b border-white/6 pb-2"
    >
      <button
        type="button"
        data-slot="archive-workspace-toggle"
        className="flex min-h-7 min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-[0.78rem] text-muted-foreground transition-colors hover:bg-white/[0.03]"
        onClick={() => onToggleGroup(group.key)}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={cn("size-3 transition-transform", expanded && "rotate-90")}
          aria-hidden="true"
        />
        <span
          data-slot="archive-workspace-name"
          className="min-w-0 flex-1 truncate"
          title={group.displayName}
        >
          {group.displayName}
        </span>
        <span className="text-[0.7rem] text-[var(--color-text-tertiary)]">
          {group.sessions.length}
        </span>
      </button>

      {expanded ? (
        <div className="ml-2 min-w-0 grid gap-1 border-l border-white/8 pl-3">
          {group.sessions.map((session) => (
            <ArchivedSessionListItem
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
