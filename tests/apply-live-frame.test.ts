import { describe, expect, it } from "vitest";
import {
  FIXTURE_DATASETS,
  LIVE_FIXTURE_FRAMES,
  type LiveWatchFrame,
} from "../src/entities/run/index.js";
import { applyLiveFrame } from "../src/features/follow-live/index.js";

function requireLiveDataset() {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-006");
  if (!dataset) {
    throw new Error("live fixture dataset missing");
  }
  return structuredClone(dataset);
}

function resolveLatestObservedTs() {
  const dataset = requireLiveDataset();
  return dataset.events.reduce(
    (latestTs, event) => Math.max(latestTs, event.endTs ?? event.startTs),
    dataset.run.startTs,
  );
}

describe("applyLiveFrame", () => {
  it("이벤트 없는 stale frame에서도 누적 duration을 유지한다", () => {
    const dataset = requireLiveDataset();
    const staleFrame = LIVE_FIXTURE_FRAMES[1];
    if (!staleFrame) {
      throw new Error("stale frame missing");
    }

    const snapshot = applyLiveFrame(dataset, staleFrame);

    expect(snapshot.connection).toBe("stale");
    expect(snapshot.dataset.run.status).toBe("stale");
    expect(snapshot.dataset.run.endTs).toBeNull();
    expect(snapshot.dataset.run.durationMs).toBe(dataset.run.durationMs);
    expect(snapshot.dataset.run.summaryMetrics.totalDurationMs).toBe(dataset.run.durationMs);
  });

  it("새 이벤트가 들어오면 최신 이벤트 시각까지 duration을 확장한다", () => {
    const dataset = requireLiveDataset();
    const nextFrame = LIVE_FIXTURE_FRAMES[0];
    if (!nextFrame) {
      throw new Error("next frame missing");
    }
    const latestFrameEvent = nextFrame.events[nextFrame.events.length - 1];
    if (!latestFrameEvent) {
      throw new Error("frame event missing");
    }

    const snapshot = applyLiveFrame(dataset, nextFrame);
    const expectedDuration = (latestFrameEvent.endTs ?? latestFrameEvent.startTs) - dataset.run.startTs;

    expect(snapshot.dataset.run.durationMs).toBe(expectedDuration);
    expect(snapshot.dataset.run.summaryMetrics.totalDurationMs).toBe(expectedDuration);
  });

  it("완료 frame에 새 이벤트가 없어도 마지막 관측 이벤트로 run을 마감한다", () => {
    const dataset = requireLiveDataset();
    const doneFrame: LiveWatchFrame = {
      delayMs: 1_000,
      events: [],
      status: "done",
    };

    const snapshot = applyLiveFrame(dataset, doneFrame);
    const latestObservedTs = resolveLatestObservedTs();
    const expectedDuration = latestObservedTs - dataset.run.startTs;

    expect(snapshot.dataset.run.status).toBe("done");
    expect(snapshot.dataset.run.endTs).toBe(latestObservedTs);
    expect(snapshot.dataset.run.durationMs).toBe(expectedDuration);
    expect(snapshot.dataset.run.summaryMetrics.totalDurationMs).toBe(expectedDuration);
  });
});
