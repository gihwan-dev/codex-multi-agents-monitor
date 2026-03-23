import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { Input } from "../../../shared/ui/primitives";
import { groupArchivedSessionsByWorkspace } from "../lib/archiveGroups";
import { ArchivedSessionFeedback } from "./ArchivedSessionFeedback";
import { ArchivedWorkspaceGroupSection } from "./ArchivedSessionGroup";

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

interface ArchivedSessionGroupsProps {
  activeFilePath: string | null;
  expandedGroups: Set<string>;
  onSelect: (filePath: string) => void;
  toggleGroup: (name: string) => void;
  workspaceGroups: ReturnType<typeof groupArchivedSessionsByWorkspace>;
}

function useArchivedSessionSearch(
  search: string,
  onSearch: (query: string) => void,
) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchPending = localSearch.trim() !== search.trim();

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearch(value), 300);
    },
    [onSearch],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return {
    localSearch,
    searchPending,
    handleSearchChange,
  };
}

function useArchiveInfiniteScroll({
  hasMore,
  indexLoading,
  onLoadMore,
  searchPending,
}: Pick<
  ArchivedSessionListProps,
  "hasMore" | "indexLoading" | "onLoadMore"
> & {
  searchPending: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || indexLoading || searchPending) {
      return undefined;
    }

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

  return sentinelRef;
}

function useExpandedArchiveGroups() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }, []);

  return {
    expandedGroups,
    toggleGroup,
  };
}

function ArchivedSessionGroups({
  activeFilePath,
  expandedGroups,
  onSelect,
  toggleGroup,
  workspaceGroups,
}: ArchivedSessionGroupsProps) {
  return workspaceGroups.map((group) => (
    <ArchivedWorkspaceGroupSection
      key={group.key}
      activeFilePath={activeFilePath}
      expanded={expandedGroups.has(group.key)}
      onSelect={onSelect}
      onToggle={() => toggleGroup(group.key)}
      sessions={group.sessions}
      title={group.displayName}
      workspaceKey={group.key}
    />
  ));
}

function ArchivedSessionCount({
  total,
  visibleItems,
}: {
  total: number;
  visibleItems: number;
}) {
  if (total <= 0) {
    return null;
  }

  return (
    <p className="px-1 text-right text-[0.7rem] text-[var(--color-text-tertiary)]">
      {visibleItems} / {total}
    </p>
  );
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
  const workspaceGroups = useMemo(() => groupArchivedSessionsByWorkspace(items), [items]);
  const { localSearch, searchPending, handleSearchChange } = useArchivedSessionSearch(search, onSearch);
  const { expandedGroups, toggleGroup } = useExpandedArchiveGroups();
  const sentinelRef = useArchiveInfiniteScroll({ hasMore, indexLoading, onLoadMore, searchPending });
  return (
    <div data-slot="archive-list" className="grid gap-2 pt-1">
      <Input
        type="search"
        className="h-8 border-white/10 bg-white/[0.03] px-2.5 text-[0.78rem]"
        placeholder="Search archived sessions"
        value={localSearch}
        onChange={(event) => handleSearchChange(event.target.value)}
        aria-label="Search archived sessions"
      />
      <div data-slot="archive-list-content" className="grid max-h-[22.5rem] gap-2 overflow-x-hidden overflow-y-auto">
        <ArchivedSessionGroups
          activeFilePath={activeFilePath}
          expandedGroups={expandedGroups}
          onSelect={onSelect}
          toggleGroup={toggleGroup}
          workspaceGroups={workspaceGroups}
        />
        <ArchivedSessionFeedback
          errorMessage={errorMessage}
          hasMore={hasMore}
          indexLoading={indexLoading}
          itemsLength={items.length}
          localSearch={localSearch}
          searchPending={searchPending}
          sentinelRef={sentinelRef}
        />
      </div>
      <ArchivedSessionCount total={total} visibleItems={items.length} />
    </div>
  );
}
