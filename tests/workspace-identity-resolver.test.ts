import { describe, expect, it, vi } from "vitest";
import { createWorkspaceIdentityResolver } from "../src/features/workspace-identity/index.js";
import { createMonitorInitialState } from "../src/pages/monitor/index.js";

function buildDataset(repoPath: string, name: string) {
  const template = createMonitorInitialState().datasets[0];
  if (!template) {
    throw new Error("fixture dataset missing");
  }

  return {
    ...template,
    project: {
      ...template.project,
      projectId: repoPath,
      repoPath,
      name,
    },
  };
}

describe("workspace identity resolver 동작", () => {
  it("네이티브 해석을 사용할 수 없으면 fallback 이름만 반환한다", async () => {
    const lookup = vi.fn();
    const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
      canResolve: () => false,
      lookup,
    });

    const overrides = await resolveWorkspaceIdentityOverrides([buildDataset("/tmp/worktrees/demo", "")]);

    expect(lookup).not.toHaveBeenCalled();
    expect(overrides["/tmp/worktrees/demo"]).toEqual({
      originPath: "/tmp/worktrees/demo",
      displayName: "demo",
      isWorktree: false,
    });
  });

  it("부분 응답은 fallback 값으로 보정하고 캐시를 재사용한다", async () => {
    const repoPath = "/tmp/repo/worktrees/feature";
    const lookup = vi.fn().mockResolvedValue({
      [repoPath]: {
        originPath: "/tmp/repo",
        isWorktree: true,
      },
    });
    const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
      canResolve: () => true,
      lookup,
    });
    const datasets = [buildDataset(repoPath, "feature-worktree")];

    const first = await resolveWorkspaceIdentityOverrides(datasets);
    const second = await resolveWorkspaceIdentityOverrides(datasets);

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(first[repoPath]).toEqual({
      originPath: "/tmp/repo",
      displayName: "feature-worktree",
      isWorktree: true,
    });
    expect(second[repoPath]).toEqual(first[repoPath]);
  });

  it("네이티브 조회가 실패한 repoPath는 같은 세션에서 반복 재시도하지 않는다", async () => {
    const repoPath = "/tmp/repo/worktrees/failing";
    const lookup = vi.fn().mockRejectedValue(new Error("bridge unavailable"));
    const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
      canResolve: () => true,
      lookup,
    });
    const datasets = [buildDataset(repoPath, "failing-worktree")];

    const first = await resolveWorkspaceIdentityOverrides(datasets);
    const second = await resolveWorkspaceIdentityOverrides(datasets);

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(first[repoPath]).toEqual({
      originPath: repoPath,
      displayName: "failing-worktree",
      isWorktree: false,
    });
    expect(second[repoPath]).toEqual(first[repoPath]);
  });

  it("조회 실패 뒤 새 repoPath가 추가되면 새 path만 다시 조회한다", async () => {
    const failingRepoPath = "/tmp/repo/worktrees/failing";
    const recoveredRepoPath = "/tmp/repo/worktrees/recovered";
    const lookup = vi
      .fn()
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockResolvedValueOnce({
        [recoveredRepoPath]: {
          originPath: "/tmp/repo",
          displayName: "recovered",
          isWorktree: true,
        },
      });
    const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
      canResolve: () => true,
      lookup,
    });

    await resolveWorkspaceIdentityOverrides([buildDataset(failingRepoPath, "failing-worktree")]);
    const overrides = await resolveWorkspaceIdentityOverrides([
      buildDataset(failingRepoPath, "failing-worktree"),
      buildDataset(recoveredRepoPath, "recovered-worktree"),
    ]);

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenNthCalledWith(1, [failingRepoPath]);
    expect(lookup).toHaveBeenNthCalledWith(2, [recoveredRepoPath]);
    expect(overrides[failingRepoPath]).toEqual({
      originPath: failingRepoPath,
      displayName: "failing-worktree",
      isWorktree: false,
    });
    expect(overrides[recoveredRepoPath]).toEqual({
      originPath: "/tmp/repo",
      displayName: "recovered",
      isWorktree: true,
    });
  });

  it("이미 캐시된 repoPath와 새 repoPath가 섞이면 새 path만 조회한다", async () => {
    const cachedRepoPath = "/tmp/repo/worktrees/cached";
    const newRepoPath = "/tmp/repo/worktrees/new";
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({
        [cachedRepoPath]: {
          originPath: "/tmp/repo",
          isWorktree: true,
        },
      })
      .mockResolvedValueOnce({
        [newRepoPath]: {
          originPath: "/tmp/repo",
          displayName: "new-worktree",
          isWorktree: true,
        },
      });
    const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
      canResolve: () => true,
      lookup,
    });

    await resolveWorkspaceIdentityOverrides([buildDataset(cachedRepoPath, "cached-worktree")]);
    const overrides = await resolveWorkspaceIdentityOverrides([
      buildDataset(cachedRepoPath, "cached-worktree"),
      buildDataset(newRepoPath, "new-worktree"),
    ]);

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenNthCalledWith(1, [cachedRepoPath]);
    expect(lookup).toHaveBeenNthCalledWith(2, [newRepoPath]);
    expect(overrides[cachedRepoPath]).toEqual({
      originPath: "/tmp/repo",
      displayName: "cached-worktree",
      isWorktree: true,
    });
    expect(overrides[newRepoPath]).toEqual({
      originPath: "/tmp/repo",
      displayName: "new-worktree",
      isWorktree: true,
    });
  });
});
