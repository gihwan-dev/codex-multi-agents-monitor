import type { SkillActivityPageAction, SkillActivityPageState } from "./types";

export const INITIAL_SKILL_ACTIVITY_STATE: SkillActivityPageState = {
  sortField: "status",
  sortDirection: "asc",
  statusFilter: "all",
  searchQuery: "",
  selectedSkillName: null,
  scanRange: 200,
};

function handleSetSort(state: SkillActivityPageState, field: SkillActivityPageState["sortField"]): SkillActivityPageState {
  const flipped = state.sortField === field && state.sortDirection === "asc";
  return { ...state, sortField: field, sortDirection: flipped ? "desc" : "asc" };
}

const ACTION_HANDLERS: Record<SkillActivityPageAction["type"], (state: SkillActivityPageState, action: SkillActivityPageAction) => SkillActivityPageState> = {
  "set-sort": (state, action) => (action.type === "set-sort" ? handleSetSort(state, action.field) : state),
  "set-status-filter": (state, action) => (action.type === "set-status-filter" ? { ...state, statusFilter: action.filter } : state),
  "set-search": (state, action) => (action.type === "set-search" ? { ...state, searchQuery: action.query } : state),
  "select-skill": (state, action) => (action.type === "select-skill" ? { ...state, selectedSkillName: action.skillName } : state),
  "set-scan-range": (state, action) => (action.type === "set-scan-range" ? { ...state, scanRange: action.range } : state),
};

export function skillActivityReducer(
  state: SkillActivityPageState,
  action: SkillActivityPageAction,
): SkillActivityPageState {
  const handler = ACTION_HANDLERS[action.type];
  return handler(state, action);
}
