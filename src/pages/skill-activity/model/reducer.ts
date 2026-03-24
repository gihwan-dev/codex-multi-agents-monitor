import type { SkillActivityPageAction, SkillActivityPageState } from "./types";

export const INITIAL_SKILL_ACTIVITY_STATE: SkillActivityPageState = {
  sortField: "status",
  sortDirection: "asc",
  statusFilter: "all",
  searchQuery: "",
  selectedSkillName: null,
};

export function skillActivityReducer(
  state: SkillActivityPageState,
  action: SkillActivityPageAction,
): SkillActivityPageState {
  switch (action.type) {
    case "set-sort": {
      const flipped = state.sortField === action.field && state.sortDirection === "asc";
      return {
        ...state,
        sortField: action.field,
        sortDirection: flipped ? "desc" : "asc",
      };
    }
    case "set-status-filter":
      return { ...state, statusFilter: action.filter };
    case "set-search":
      return { ...state, searchQuery: action.query };
    case "select-skill":
      return { ...state, selectedSkillName: action.skillName };
  }
}
