import type { SkillFreshnessFilter, SkillSortDirection, SkillSortField, SkillSourceFilter } from "../../../entities/skill";

export const SCAN_RANGE_OPTIONS = [
  { value: 50, label: "Recent 50" },
  { value: 200, label: "Recent 200" },
  { value: 500, label: "Recent 500" },
  { value: 0, label: "All sessions" },
] as const;

export type ScanRangeValue = (typeof SCAN_RANGE_OPTIONS)[number]["value"];

export interface SkillActivityPageState {
  sortField: SkillSortField;
  sortDirection: SkillSortDirection;
  freshnessFilter: SkillFreshnessFilter;
  sourceFilter: SkillSourceFilter;
  searchQuery: string;
  scanRange: ScanRangeValue;
}

export type SkillActivityPageAction =
  | { type: "set-sort"; field: SkillSortField }
  | { type: "set-freshness-filter"; filter: SkillFreshnessFilter }
  | { type: "set-source-filter"; filter: SkillSourceFilter }
  | { type: "set-search"; query: string }
  | { type: "set-scan-range"; range: ScanRangeValue };
