import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { Input } from "../../../shared/ui/primitives";
import { useArchivedSessionListState } from "../model/useArchivedSessionListState";
import { ArchivedSessionListGroup } from "./ArchivedSessionListGroup";

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
  const {
    expandedGroups,
    handleSearchChange,
    localSearch,
    searchPending,
    sentinelRef,
    toggleGroup,
    workspaceGroups,
  } = useArchivedSessionListState({
    hasMore,
    indexLoading,
    items,
    onLoadMore,
    onSearch,
    search,
  });

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
            <ArchivedSessionListGroup
              key={group.key}
              activeFilePath={activeFilePath}
              expanded={expanded}
              group={group}
              onSelect={onSelect}
              onToggleGroup={toggleGroup}
            />
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
