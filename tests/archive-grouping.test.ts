import { describe, expect, it } from "vitest";
import type { ArchivedSessionIndexItem } from "../src/entities/run/index.js";
import { groupArchivedSessionsByWorkspace } from "../src/widgets/workspace-run-tree/lib/archiveGroups.js";

function buildArchivedItem(
  overrides: Partial<ArchivedSessionIndexItem>,
): ArchivedSessionIndexItem {
  return {
    sessionId: "session-1",
    workspacePath: "/tmp/workspace-a",
    originPath: "/tmp/workspace-a",
    displayName: "web",
    startedAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
    model: null,
    messageCount: 1,
    filePath: "/tmp/workspace-a/session-1.json",
    firstUserMessage: null,
    ...overrides,
  };
}

describe("archive 그룹핑", () => {
  it("같은 표시 이름이어도 originPath가 다르면 그룹을 분리한다", () => {
    const groups = groupArchivedSessionsByWorkspace([
      buildArchivedItem({
        sessionId: "session-a",
        originPath: "/repo-a/web",
        workspacePath: "/repo-a/web",
        filePath: "/repo-a/web/session-a.json",
      }),
      buildArchivedItem({
        sessionId: "session-b",
        originPath: "/repo-b/web",
        workspacePath: "/repo-b/web",
        filePath: "/repo-b/web/session-b.json",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.key)).toEqual(["/repo-a/web", "/repo-b/web"]);
  });

  it("같은 originPath는 하나의 workspace 그룹으로 묶는다", () => {
    const groups = groupArchivedSessionsByWorkspace([
      buildArchivedItem({
        sessionId: "session-a",
        originPath: "/repo-a/web",
        workspacePath: "/repo-a/web",
        filePath: "/repo-a/web/session-a.json",
      }),
      buildArchivedItem({
        sessionId: "session-b",
        originPath: "/repo-a/web",
        workspacePath: "/repo-a/web/worktree",
        filePath: "/repo-a/web/session-b.json",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sessions.map((session) => session.sessionId)).toEqual([
      "session-a",
      "session-b",
    ]);
  });
});
