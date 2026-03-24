import { useMemo, useReducer } from "react";
import type { RunDataset } from "../../../entities/run";
import {
  buildSkillActivityItems,
  filterSkillsBySearch,
  filterSkillsByStatus,
  type SkillActivityItem,
  type SkillSortField,
  type SkillStatusFilter,
  sortSkills,
} from "../../../entities/skill";
import { INITIAL_SKILL_ACTIVITY_STATE, skillActivityReducer } from "./reducer";

interface UseSkillActivityPageViewOptions {
  datasets: readonly RunDataset[];
  activeRunId: string;
  onNavigateToMonitor: () => void;
  onNavigateToEvent: (eventId: string) => void;
}

export function useSkillActivityPageView({
  datasets,
  activeRunId,
  onNavigateToMonitor,
  onNavigateToEvent,
}: UseSkillActivityPageViewOptions) {
  const [state, dispatch] = useReducer(skillActivityReducer, INITIAL_SKILL_ACTIVITY_STATE);

  const allItems = useMemo(
    () => buildSkillActivityItems(datasets, activeRunId),
    [datasets, activeRunId],
  );

  const hasCatalog = allItems.some((item) => item.catalogSource !== null);

  const filteredItems = useMemo(() => {
    const byStatus = filterSkillsByStatus(allItems, state.statusFilter);
    const bySearch = filterSkillsBySearch(byStatus, state.searchQuery);
    return sortSkills(bySearch, state.sortField, state.sortDirection);
  }, [allItems, state.statusFilter, state.searchQuery, state.sortField, state.sortDirection]);

  const handleSkillClick = (item: SkillActivityItem) => {
    if (item.recentInvocations.length > 0) {
      onNavigateToEvent(item.recentInvocations[0].eventId);
    }
  };

  return {
    state,
    items: filteredItems,
    hasCatalog,
    totalCount: allItems.length,
    setSort: (field: SkillSortField) => dispatch({ type: "set-sort", field }),
    setStatusFilter: (filter: SkillStatusFilter) => dispatch({ type: "set-status-filter", filter }),
    setSearch: (query: string) => dispatch({ type: "set-search", query }),
    onSkillClick: handleSkillClick,
    onNavigateToMonitor,
  };
}
