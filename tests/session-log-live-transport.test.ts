import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  subscribeRecentSessionLive,
  type RecentSessionLiveUpdate,
} from "../src/entities/session-log/index.js";
import {
  canInvokeTauriRuntime,
  invokeTauri,
  listenTauri,
  type ListenTauriEvent,
} from "../src/shared/api/index.js";

vi.mock("../src/shared/api/index.js", () => ({
  canInvokeTauriRuntime: vi.fn(),
  invokeTauri: vi.fn(),
  listenTauri: vi.fn(),
}));

const mockedCanInvokeTauriRuntime = vi.mocked(canInvokeTauriRuntime);
const mockedInvokeTauri = vi.mocked(invokeTauri);
const mockedListenTauri = vi.mocked(listenTauri);

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("subscribeRecentSessionLive", () => {
  beforeEach(() => {
    mockedCanInvokeTauriRuntime.mockReturnValue(true);
    mockedInvokeTauri.mockReset();
    mockedListenTauri.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts and stops the recent live subscription through the tauri bridge", async () => {
    const onUpdate = vi.fn();
    const unlisten = vi.fn();

    mockedListenTauri.mockResolvedValue(unlisten);
    mockedInvokeTauri
      .mockResolvedValueOnce({ subscriptionId: "sub-1" })
      .mockResolvedValueOnce(undefined);

    const unsubscribe = subscribeRecentSessionLive("/tmp/live.jsonl", { onUpdate });
    await flushMicrotasks();

    expect(mockedListenTauri).toHaveBeenCalledWith(
      "recent-session-live-update",
      expect.any(Function),
    );
    expect(mockedInvokeTauri).toHaveBeenNthCalledWith(
      1,
      "start_recent_session_live_subscription",
      { filePath: "/tmp/live.jsonl" },
    );

    unsubscribe();
    await flushMicrotasks();

    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(mockedInvokeTauri).toHaveBeenNthCalledWith(
      2,
      "stop_recent_session_live_subscription",
      { subscriptionId: "sub-1" },
    );
  });

  it("ignores transport updates for a different subscription id", async () => {
    const onUpdate = vi.fn();
    const unlisten = vi.fn();
    let eventHandler:
      | ((event: ListenTauriEvent<RecentSessionLiveUpdate>) => void)
      | undefined;

    mockedListenTauri.mockImplementation(async (_eventName, handler) => {
      eventHandler = handler;
      return unlisten;
    });
    mockedInvokeTauri.mockResolvedValue({ subscriptionId: "sub-1" });

    subscribeRecentSessionLive("/tmp/live.jsonl", { onUpdate });
    await flushMicrotasks();

    expect(eventHandler).toBeDefined();
    if (!eventHandler) {
      throw new Error("event handler missing");
    }

    eventHandler({
      event: "recent-session-live-update",
      id: 1,
      payload: {
        subscriptionId: "sub-2",
        filePath: "/tmp/live.jsonl",
        connection: "live",
      },
    });
    eventHandler({
      event: "recent-session-live-update",
      id: 2,
      payload: {
        subscriptionId: "sub-1",
        filePath: "/tmp/live.jsonl",
        connection: "stale",
      },
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      subscriptionId: "sub-1",
      filePath: "/tmp/live.jsonl",
      connection: "stale",
    });
  });
});
