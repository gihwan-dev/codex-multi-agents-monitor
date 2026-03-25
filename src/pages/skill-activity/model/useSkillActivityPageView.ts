import { useEffect, useMemo, useReducer, useState } from "react";
import type { RunDataset } from "../../../entities/run";
import {
  buildSkillActivityItems,
  filterSkillsByFreshness,
  filterSkillsBySearch,
  filterSkillsBySource,
  loadSkillActivityScan,
  type SkillActivityItem,
  type SkillFreshnessFilter,
  type SkillInvocationSummary,
  type SkillSortField,
  type SkillSourceFilter,
  sortSkills,
} from "../../../entities/skill";
import { INITIAL_SKILL_ACTIVITY_STATE, skillActivityReducer } from "./reducer";
import type { ScanRangeValue } from "./types";

interface UseSkillActivityPageViewOptions {
  datasets: readonly RunDataset[];
  activeRunId: string;
  onNavigateToMonitor: () => void;
  onNavigateToEvent: (eventId: string) => void;
}

function useScanInvocations(scanRange: number) {
  const [scanResult, setScanResult] = useState<readonly SkillInvocationSummary[]>([]);
  const [scanLoading, setScanLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setScanLoading(true);
    loadSkillActivityScan(scanRange).then((result) => {
      if (!cancelled) {
        setScanResult(result);
        setScanLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [scanRange]);

  return { scanResult, scanLoading };
}

export function useSkillActivityPageView(opts: UseSkillActivityPageViewOptions) {
  const [state, dispatch] = useReducer(skillActivityReducer, INITIAL_SKILL_ACTIVITY_STATE);
  const { scanResult, scanLoading } = useScanInvocations(state.scanRange);

  const allItems = useMemo(
    () => buildSkillActivityItems({ datasets: opts.datasets, activeRunId: opts.activeRunId, externalInvocations: scanResult }),
    [opts.datasets, opts.activeRunId, scanResult],
  );

  const hasCatalog = allItems.some((item) => item.catalogSource !== null);

  const filteredItems = useMemo(() => {
    let result = filterSkillsByFreshness(allItems, state.freshnessFilter);
    result = filterSkillsBySource(result, state.sourceFilter);
    result = filterSkillsBySearch(result, state.searchQuery);
    return sortSkills(result, state.sortField, state.sortDirection);
  }, [allItems, state.freshnessFilter, state.sourceFilter, state.searchQuery, state.sortField, state.sortDirection]);

  const handleSkillClick = (item: SkillActivityItem) => {
    if (item.recentInvocations.length > 0) {
      opts.onNavigateToEvent(item.recentInvocations[0].eventId);
    }
  };

  return {
    state,
    items: filteredItems,
    hasCatalog,
    totalCount: allItems.length,
    scanLoading,
    setSort: (field: SkillSortField) => dispatch({ type: "set-sort", field }),
    setFreshnessFilter: (filter: SkillFreshnessFilter) => dispatch({ type: "set-freshness-filter", filter }),
    setSourceFilter: (filter: SkillSourceFilter) => dispatch({ type: "set-source-filter", filter }),
    setSearch: (query: string) => dispatch({ type: "set-search", query }),
    setScanRange: (range: ScanRangeValue) => dispatch({ type: "set-scan-range", range }),
    onSkillClick: handleSkillClick,
    onNavigateToMonitor: opts.onNavigateToMonitor,
  };
}
