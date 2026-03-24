import type { SkillSortDirection, SkillSortField, SkillStatusFilter } from "../../../entities/skill";

export interface SkillActivityPageState {
  sortField: SkillSortField;
  sortDirection: SkillSortDirection;
  statusFilter: SkillStatusFilter;
  searchQuery: string;
  selectedSkillName: string | null;
}

export type SkillActivityPageAction =
  | { type: "set-sort"; field: SkillSortField }
  | { type: "set-status-filter"; filter: SkillStatusFilter }
  | { type: "set-search"; query: string }
  | { type: "select-skill"; skillName: string | null };
