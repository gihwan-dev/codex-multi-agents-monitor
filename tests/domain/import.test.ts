import { describe, expect, it } from "vitest";
import { createMonitorInitialState, monitorStateReducer } from "../../src/app/useMonitorAppState.js";
import { FIXTURE_DATASETS, FIXTURE_IMPORT_TEXT } from "../../src/features/fixtures/index.js";
import { normalizeImportPayload, parseCompletedRunPayload } from "../../src/features/ingestion/index.js";
import { buildAnomalyJumps, calculateSummaryMetrics, hasRawPayload } from "../../src/shared/domain/index.js";

describe("completedRunParser", () => {
  it("rejects waiting-class events without wait_reason", () => {
    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          project: { projectId: "a", name: "x", repoPath: "x" },
          session: { sessionId: "s", title: "t", owner: "o", startedAt: 1 },
          run: {
            traceId: "r",
            title: "r",
            status: "waiting",
            startTs: 1,
            endTs: null,
            environment: "Import",
            liveMode: "imported",
            finalArtifactId: null,
            selectedByDefaultId: null,
            rawIncluded: false,
            noRawStorage: true,
          },
          lanes: [
            {
              laneId: "l",
              agentId: "a",
              threadId: "t",
              name: "Lane",
              role: "worker",
              model: "gpt-5",
              provider: "OpenAI",
              badge: "Main",
              laneStatus: "waiting",
            },
          ],
          events: [
            {
              event_id: "e",
              lane_id: "l",
              agent_id: "a",
              thread_id: "t",
              event_type: "agent.state_changed",
              status: "waiting",
              start_ts: 1,
              title: "Waiting",
            },
          ],
          edges: [],
          artifacts: [],
        }),
      ),
    ).toThrow(/wait_reason/i);
  });

  it("rejects invalid edge enums", () => {
    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          ...JSON.parse(FIXTURE_IMPORT_TEXT),
          edges: [
            {
              edgeId: "bad",
              edgeType: "invalid",
              sourceAgentId: "a",
              targetAgentId: "b",
              sourceEventId: "e1",
              targetEventId: "e2",
              payloadPreview: "bad",
              artifactId: null,
            },
          ],
        }),
      ),
    ).toThrow(/edgeType/i);
  });

  it("rejects non-array artifacts", () => {
    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          ...JSON.parse(FIXTURE_IMPORT_TEXT),
          artifacts: {},
        }),
      ),
    ).toThrow(/artifacts must be an array/i);
  });
});

describe("normalization and selectors", () => {
  it("redacts raw payload by default", () => {
    const dataset = normalizeImportPayload(parseCompletedRunPayload(FIXTURE_IMPORT_TEXT), {
      allowRaw: false,
      noRawStorage: true,
    });

    expect(dataset.run.rawIncluded).toBe(false);
    expect(dataset.events[0]?.rawInput).toBeNull();
    expect(dataset.events[0]?.rawOutput).toBeNull();
  });

  it("exposes final artifact jump for imported runs", () => {
    const dataset = normalizeImportPayload(parseCompletedRunPayload(FIXTURE_IMPORT_TEXT), {
      allowRaw: false,
      noRawStorage: true,
    });

    expect(buildAnomalyJumps(dataset).some((jump) => jump.label === "Final artifact")).toBe(true);
  });

  it("calculates peak parallelism from actual overlap", () => {
    const source = FIXTURE_DATASETS.find((item) => item.lanes.length >= 2 && item.events.length >= 3);
    expect(source).toBeDefined();
    if (!source) {
      throw new Error("fixture with overlap inputs missing");
    }

    const [laneA, laneB] = source.lanes;
    const [eventA, eventB, eventC] = source.events;
    const dataset = {
      ...source,
      run: {
        ...source.run,
        durationMs: 250,
      },
      lanes: [laneA, laneB],
      events: [
        { ...eventA, eventId: "peak-a", laneId: laneA.laneId, startTs: 0, endTs: 100, durationMs: 100 },
        { ...eventB, eventId: "peak-b", laneId: laneB.laneId, startTs: 50, endTs: 150, durationMs: 100 },
        { ...eventC, eventId: "peak-c", laneId: laneA.laneId, startTs: 180, endTs: 250, durationMs: 70 },
      ],
      edges: [],
      artifacts: [],
    };

    const metrics = calculateSummaryMetrics(dataset);
    expect(metrics.peakParallelism).toBe(2);
  });
});

describe("monitor state contracts", () => {
  it("defaults follow-live on only for live runs", () => {
    const state = createMonitorInitialState();
    const liveRun = FIXTURE_DATASETS.find((item) => item.run.liveMode === "live");
    const importedRun = FIXTURE_DATASETS.find((item) => item.run.liveMode === "imported");

    expect(liveRun).toBeDefined();
    expect(importedRun).toBeDefined();
    if (!liveRun || !importedRun) {
      throw new Error("fixture live/imported runs missing");
    }

    expect(state.followLiveByRunId[liveRun.run.traceId]).toBe(true);
    expect(state.followLiveByRunId[importedRun.run.traceId]).toBe(false);
  });

  it("keeps imported runs follow-live off after import", () => {
    const dataset = normalizeImportPayload(parseCompletedRunPayload(FIXTURE_IMPORT_TEXT), {
      allowRaw: false,
      noRawStorage: true,
    });

    const nextState = monitorStateReducer(createMonitorInitialState(), {
      type: "import-dataset",
      dataset,
    });

    expect(nextState.activeRunId).toBe(dataset.run.traceId);
    expect(nextState.followLiveByRunId[dataset.run.traceId]).toBe(false);
  });

  it("stores filters per trace instead of globally", () => {
    const liveRun = FIXTURE_DATASETS.find((item) => item.run.liveMode === "live");
    const importedRun = FIXTURE_DATASETS.find((item) => item.run.liveMode === "imported");

    expect(liveRun).toBeDefined();
    expect(importedRun).toBeDefined();
    if (!liveRun || !importedRun) {
      throw new Error("fixture live/imported runs missing");
    }

    const withImportedSearch = monitorStateReducer(createMonitorInitialState(), {
      type: "set-filter",
      traceId: importedRun.run.traceId,
      key: "search",
      value: "handoff",
    });
    const withLiveErrorOnly = monitorStateReducer(withImportedSearch, {
      type: "set-filter",
      traceId: liveRun.run.traceId,
      key: "errorOnly",
      value: true,
    });

    expect(withLiveErrorOnly.filtersByRunId[importedRun.run.traceId]?.search).toBe("handoff");
    expect(withLiveErrorOnly.filtersByRunId[liveRun.run.traceId]?.search).toBe("");
    expect(withLiveErrorOnly.filtersByRunId[liveRun.run.traceId]?.errorOnly).toBe(true);
  });

  it("hides raw tabs when the selected dataset has no raw payload", () => {
    const dataset = normalizeImportPayload(parseCompletedRunPayload(FIXTURE_IMPORT_TEXT), {
      allowRaw: false,
      noRawStorage: true,
    });
    expect(hasRawPayload(dataset)).toBe(false);

    const importedState = monitorStateReducer(createMonitorInitialState(), {
      type: "import-dataset",
      dataset,
    });
    const rawSelectedState = {
      ...importedState,
      inspectorTab: "raw" as const,
      drawerTab: "raw" as const,
    };

    const nextState = monitorStateReducer(rawSelectedState, {
      type: "set-active-run",
      traceId: dataset.run.traceId,
    });

    expect(nextState.inspectorTab).toBe("summary");
    expect(nextState.drawerTab).toBe("artifacts");
  });
});
