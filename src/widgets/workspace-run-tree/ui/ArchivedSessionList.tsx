import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { deriveArchiveIndexTitle } from "../../../entities/session-log";
import { cn } from "../../../shared/lib";
import { Input } from "../../../shared/ui/primitives";
import { groupArchivedSessionsByWorkspace } from "../lib/archiveGroups";

interface ArchivedSessionListProps {
  items: ArchivedSessionIndexItem[];
  total: number;
  hasMore: boolean;
  indexLoading: boolean;
  errorMessage: string | null;
  activeFilePath: string | null;
  search: string;
  onSearch: (query: string) => void;
  onLoadMore: () => void;
  onSelect: (filePath: string) => void;
}

export function ArchivedSessionList({
  items,
  total,
  hasMore,
  indexLoading,
  errorMessage,
  activeFilePath,
  search,
  onSearch,
  onLoadMore,
  onSelect,
}: ArchivedSessionListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [localSearch, setLocalSearch] = useState(search);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const workspaceGroups = useMemo(() => groupArchivedSessionsByWorkspace(items), [items]);
  const searchPending = localSearch.trim() !== search.trim();

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearch(value), 300);
    },
    [onSearch],
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || indexLoading || searchPending) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, indexLoading, onLoadMore, searchPending]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div data-slot="archive-list" className="grid gap-2 pt-1">
      <Input
        type="search"
        className="h-8 border-white/10 bg-white/[0.03] px-2.5 text-[0.78rem]"
        placeholder="Search archived sessions"
        value={localSearch}
        onChange={(e) => handleSearchChange(e.target.value)}
        aria-label="Search archived sessions"
      />

      <div
        data-slot="archive-list-content"
        className="grid max-h-[22.5rem] gap-2 overflow-x-hidden overflow-y-auto"
      >
        {workspaceGroups.map((group) => {
          const expanded = expandedGroups.has(group.key);
          return (
            <section
              key={group.key}
              data-slot="archive-workspace-group"
              data-workspace-key={group.key}
              className="grid gap-1 border-b border-white/6 pb-2"
            >
              <button
                type="button"
                data-slot="archive-workspace-toggle"
                className="flex min-h-7 min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-[0.78rem] text-muted-foreground transition-colors hover:bg-white/[0.03]"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
              >
                <ChevronRight
                  className={cn(
                    "size-3 transition-transform",
                    expanded && "rotate-90",
                  )}
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
                    <button
                      key={session.filePath}
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
                        {session.model ? (
                          <span className="shrink-0 text-[0.72rem] text-[var(--color-text-tertiary)]">
                            {session.model}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-[0.72rem] text-[var(--color-text-tertiary)]">
                        <span>{formatArchiveDate(session.startedAt)}</span>
                        <span>{session.sessionId.slice(0, 8)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {indexLoading ? (
          <>
            <div key="skeleton-a" className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
            <div key="skeleton-b" className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
            <div key="skeleton-c" className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
          </>
        ) : null}

        {!indexLoading && !searchPending && errorMessage ? (
          <output className="text-sm text-[var(--color-failed)]" aria-live="polite">
            {errorMessage}
          </output>
        ) : null}

        {!indexLoading && !searchPending && !errorMessage && items.length === 0 ? (
          <p className="px-2 py-2 text-[0.78rem] text-[var(--color-text-tertiary)]">
            {localSearch ? "No matching archived sessions." : "No archived sessions found."}
          </p>
        ) : null}

        {hasMore && !indexLoading && !searchPending && !errorMessage ? (
          <div
            ref={sentinelRef}
            data-slot="archive-sentinel"
            className="h-px"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {total > 0 ? (
        <p className="px-1 text-right text-[0.7rem] text-[var(--color-text-tertiary)]">
          {items.length} / {total}
        </p>
      ) : null}
    </div>
  );
}

function deriveArchiveItemTitle(session: ArchivedSessionIndexItem): string {
  return deriveArchiveIndexTitle(session.firstUserMessage) ?? formatArchiveDate(session.startedAt);
}

function formatArchiveDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
