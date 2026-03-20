import { describe, expect, it } from "vitest";
import type { WorkspaceTreeItem } from "../src/entities/run/index.js";
import {
  buildRunTreeId,
  buildWorkspaceTreeId,
  findRunTreeId,
  flattenTree,
  resolveActiveTreeId,
  resolveExpandedWorkspaceIds,
  resolveTreeKeyAction,
} from "../src/widgets/workspace-run-tree/index.js";

const WORKSPACES: WorkspaceTreeItem[] = [
  {
    id: "workspace-a",
    name: "Workspace A",
    repoPath: "/repo/a",
    badge: "Main",
    runCount: 2,
    threads: [
      {
        id: "thread-a",
        title: "Thread A",
        runs: [
          {
            id: "run-a1",
            title: "Run A1",
            status: "running",
            lastEventSummary: "Planner is active",
            lastActivityTs: 20,
            relativeTime: "now",
            liveMode: "live",
          },
          {
            id: "run-a0",
            title: "Run A0",
            status: "done",
            lastEventSummary: "Completed",
            lastActivityTs: 10,
            relativeTime: "1m",
            liveMode: "imported",
          },
        ],
      },
    ],
  },
  {
    id: "workspace-b",
    name: "Workspace B",
    repoPath: "/repo/b",
    badge: null,
    runCount: 1,
    threads: [
      {
        id: "thread-b",
        title: "Thread B",
        runs: [
          {
            id: "run-b1",
            title: "Run B1",
            status: "waiting",
            lastEventSummary: "Blocked on review",
            lastActivityTs: 15,
            relativeTime: "30s",
            liveMode: "imported",
          },
        ],
      },
    ],
  },
];

describe("workspaceTreeUtils", () => {
  it("확장된 workspace만 flat tree에 run row를 포함한다", () => {
    const flatItems = flattenTree(WORKSPACES, ["workspace-a"]);

    expect(flatItems.map((item) => item.treeId)).toEqual([
      buildWorkspaceTreeId("workspace-a"),
      buildRunTreeId("workspace-a", "run-a1"),
      buildRunTreeId("workspace-a", "run-a0"),
      buildWorkspaceTreeId("workspace-b"),
    ]);
  });

  it("현재 active run에 대응하는 tree id를 찾고 없으면 첫 workspace로 fallback 한다", () => {
    expect(findRunTreeId(WORKSPACES, "run-b1")).toBe(
      buildRunTreeId("workspace-b", "run-b1"),
    );
    expect(resolveActiveTreeId(WORKSPACES, "missing-run")).toBe(
      buildWorkspaceTreeId("workspace-a"),
    );
  });

  it("사라진 workspace id를 정리하고 모두 접힌 경우 전체를 다시 펼친다", () => {
    expect(resolveExpandedWorkspaceIds(WORKSPACES, ["workspace-a", "missing"])).toEqual([
      "workspace-a",
    ]);
    expect(resolveExpandedWorkspaceIds(WORKSPACES, ["missing"])).toEqual([
      "workspace-a",
      "workspace-b",
    ]);
  });

  it("ArrowRight는 닫힌 workspace를 먼저 펼치고, 한 번 더 누르면 첫 run으로 이동한다", () => {
    const flatItems = flattenTree(WORKSPACES, []);
    const expandAction = resolveTreeKeyAction({
      key: "ArrowRight",
      flatItems,
      activeTreeId: buildWorkspaceTreeId("workspace-a"),
      activeRunId: "run-a1",
      workspaces: WORKSPACES,
      expandedWorkspaceIds: [],
    });

    expect(expandAction).toMatchObject({
      handled: true,
      expandedWorkspaceIds: ["workspace-a"],
    });

    const focusRunAction = resolveTreeKeyAction({
      key: "ArrowRight",
      flatItems: flattenTree(WORKSPACES, ["workspace-a"]),
      activeTreeId: buildWorkspaceTreeId("workspace-a"),
      activeRunId: "run-a1",
      workspaces: WORKSPACES,
      expandedWorkspaceIds: ["workspace-a"],
    });

    expect(focusRunAction).toMatchObject({
      handled: true,
      activeTreeId: buildRunTreeId("workspace-a", "run-a1"),
      focusTreeId: buildRunTreeId("workspace-a", "run-a1"),
    });
  });

  it("ArrowLeft는 workspace row를 접고 포커스는 현재 workspace에 유지한다", () => {
    const collapseWorkspaceAction = resolveTreeKeyAction({
      key: "ArrowLeft",
      flatItems: flattenTree(WORKSPACES, ["workspace-a"]),
      activeTreeId: buildWorkspaceTreeId("workspace-a"),
      activeRunId: "run-a1",
      workspaces: WORKSPACES,
      expandedWorkspaceIds: ["workspace-a"],
    });

    expect(collapseWorkspaceAction).toMatchObject({
      handled: true,
      expandedWorkspaceIds: [],
    });
    expect(collapseWorkspaceAction.activeTreeId).toBeUndefined();
    expect(collapseWorkspaceAction.focusTreeId).toBeUndefined();
  });

  it("ArrowLeft와 Enter는 run selection에서 workspace 복귀와 run 선택을 처리한다", () => {
    const flatItems = flattenTree(WORKSPACES, ["workspace-a"]);
    const activeTreeId = buildRunTreeId("workspace-a", "run-a1");

    const collapseAction = resolveTreeKeyAction({
      key: "ArrowLeft",
      flatItems,
      activeTreeId,
      activeRunId: "run-a1",
      workspaces: WORKSPACES,
      expandedWorkspaceIds: ["workspace-a"],
    });
    expect(collapseAction).toMatchObject({
      handled: true,
      activeTreeId: buildWorkspaceTreeId("workspace-a"),
      focusTreeId: buildWorkspaceTreeId("workspace-a"),
    });

    const selectAction = resolveTreeKeyAction({
      key: "Enter",
      flatItems,
      activeTreeId,
      activeRunId: "run-a1",
      workspaces: WORKSPACES,
      expandedWorkspaceIds: ["workspace-a"],
    });
    expect(selectAction).toMatchObject({
      handled: true,
      activeTreeId,
      selectRunId: "run-a1",
    });
  });
});
