import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { groupArchivedSessionsByWorkspace } from "../lib/archiveGroups";
import {
  isArchivedSessionSearchPending,
  toggleArchivedSessionGroup,
} from "./archivedSessionListState";

interface UseArchivedSessionListStateOptions {
  hasMore: boolean;
  indexLoading: boolean;
  items: ArchivedSessionIndexItem[];
  onLoadMore: () => void;
  onSearch: (query: string) => void;
  search: string;
}

export function useArchivedSessionListState({
  hasMore,
  indexLoading,
  items,
  onLoadMore,
  onSearch,
  search,
}: UseArchivedSessionListStateOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [localSearch, setLocalSearch] = useState(search);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const workspaceGroups = useMemo(() => groupArchivedSessionsByWorkspace(items), [items]);
  const searchPending = isArchivedSessionSearchPending(localSearch, search);

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

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((current) => toggleArchivedSessionGroup(current, groupKey));
  }, []);

  return {
    expandedGroups,
    handleSearchChange,
    localSearch,
    searchPending,
    sentinelRef,
    toggleGroup,
    workspaceGroups,
  };
}
