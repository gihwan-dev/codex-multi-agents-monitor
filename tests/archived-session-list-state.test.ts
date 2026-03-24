import { describe, expect, it } from "vitest";
import {
  isArchivedSessionSearchPending,
  toggleArchivedSessionGroup,
} from "../src/widgets/workspace-run-tree/model/archivedSessionListState.js";

describe("archivedSessionListState", () => {
  it("treats trimmed draft and committed search values as equivalent", () => {
    expect(isArchivedSessionSearchPending("  planner  ", "planner")).toBe(false);
    expect(isArchivedSessionSearchPending("planner next", "planner")).toBe(true);
  });

  it("toggles an archived workspace group on and off", () => {
    const expanded = toggleArchivedSessionGroup(new Set<string>(), "/tmp/workspace-a");
    expect(expanded.has("/tmp/workspace-a")).toBe(true);

    const collapsed = toggleArchivedSessionGroup(expanded, "/tmp/workspace-a");
    expect(collapsed.has("/tmp/workspace-a")).toBe(false);
  });
});
