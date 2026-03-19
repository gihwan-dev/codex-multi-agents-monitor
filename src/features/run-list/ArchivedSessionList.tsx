import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveArchiveIndexTitle } from "../../app/sessionLogLoader";
import type { ArchivedSessionIndexItem } from "../../shared/domain";
import { groupArchivedSessionsByWorkspace } from "./archiveGroups";

interface ArchivedSessionListProps {
  items: ArchivedSessionIndexItem[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  search: string;
  onSearch: (query: string) => void;
  onLoadMore: () => void;
  onSelect: (filePath: string) => void;
}

export function ArchivedSessionList({
  items,
  total,
  hasMore,
  loading,
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
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return undefined;

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
  }, [hasMore, loading, onLoadMore]);

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
    <div className="archive-list">
      <input
        type="search"
        className="search-input archive-list__search"
        placeholder="Search archived sessions"
        value={localSearch}
        onChange={(e) => handleSearchChange(e.target.value)}
        aria-label="Search archived sessions"
      />

      <div className="archive-list__tree">
        {workspaceGroups.map((group) => {
          const expanded = expandedGroups.has(group.key);
          return (
            <section key={group.key} className="archive-list__workspace">
              <button
                type="button"
                className="run-list__workspace-row"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
              >
                <div className="run-list__workspace-copy">
                  <span
                    className={`run-list__disclosure${expanded ? " run-list__disclosure--open" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="run-list__workspace-name" title={group.displayName}>
                    {group.displayName}
                  </span>
                  <span className="run-list__workspace-count">
                    {group.sessions.length}
                  </span>
                </div>
              </button>

              {expanded ? (
                <div className="run-list__runs">
                  {group.sessions.map((session) => (
                    <button
                      key={session.filePath}
                      type="button"
                      className="run-row"
                      onClick={() => onSelect(session.filePath)}
                      title={session.workspacePath}
                    >
                      <div className="run-row__title">
                        <span>{deriveArchiveItemTitle(session)}</span>
                        {session.model ? (
                          <span className="archive-list__model-badge">{session.model}</span>
                        ) : null}
                      </div>
                      <div className="run-row__sub">
                        <span className="run-row__meta">{formatArchiveDate(session.startedAt)}</span>
                        <span className="run-row__meta">{session.sessionId.slice(0, 8)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {loading ? (
          <>
            <div key="skeleton-a" className="archive-list__skeleton" aria-hidden="true" />
            <div key="skeleton-b" className="archive-list__skeleton" aria-hidden="true" />
            <div key="skeleton-c" className="archive-list__skeleton" aria-hidden="true" />
          </>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="archive-list__empty">
            {localSearch ? "No matching archived sessions." : "No archived sessions found."}
          </p>
        ) : null}

        {hasMore && !loading ? (
          <div ref={sentinelRef} className="archive-list__sentinel" aria-hidden="true" />
        ) : null}
      </div>

      {total > 0 ? (
        <p className="archive-list__count">
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
