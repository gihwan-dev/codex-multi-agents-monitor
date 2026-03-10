import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getHistorySummary,
  getThreadDetail,
  getThreadDrilldown,
  listLiveThreads,
  openLogFile,
  openWorkspace,
} from "@/shared/lib/tauri/commands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("tauri bridge command contracts", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it("pins list_live_threads command name", async () => {
    await listLiveThreads();
    expect(invokeMock).toHaveBeenCalledWith("list_live_threads");
  });

  it("pins get_thread_detail argument key", async () => {
    await getThreadDetail("thread-1");
    expect(invokeMock).toHaveBeenCalledWith("get_thread_detail", {
      threadId: "thread-1",
    });
  });

  it("pins get_thread_drilldown argument keys", async () => {
    await getThreadDrilldown("thread-1", "session-a");
    expect(invokeMock).toHaveBeenCalledWith("get_thread_drilldown", {
      threadId: "thread-1",
      laneId: "session-a",
    });
  });

  it("pins get_history_summary command name", async () => {
    await getHistorySummary();
    expect(invokeMock).toHaveBeenCalledWith("get_history_summary");
  });

  it("pins open_workspace argument key", async () => {
    await openWorkspace("/tmp/workspace");
    expect(invokeMock).toHaveBeenCalledWith("open_workspace", {
      path: "/tmp/workspace",
    });
  });

  it("pins open_log_file argument key", async () => {
    await openLogFile("/tmp/rollout.jsonl");
    expect(invokeMock).toHaveBeenCalledWith("open_log_file", {
      path: "/tmp/rollout.jsonl",
    });
  });
});
