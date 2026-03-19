import { describe, expect, it } from "vitest";
import { createMonitorInitialState, monitorStateReducer } from "../../src/app/useMonitorAppState.js";
import { FIXTURE_DATASETS, FIXTURE_IMPORT_TEXT } from "../../src/features/fixtures/index.js";
import { normalizeImportPayload, parseCompletedRunPayload } from "../../src/features/ingestion/index.js";
import {
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  buildWorkspaceTreeModel,
  calculateSummaryMetrics,
  hasRawPayload,
} from "../../src/shared/domain/index.js";

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

  it("builds a graph model that keeps the blocker path readable", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    const scene = buildGraphSceneModel(
      dataset,
      { agentId: null, eventType: "all", search: "", errorOnly: false },
      { kind: "event", id: "fix2-blocked" },
      true,
    );

    expect(scene.rows.some((row) => row.kind === "event" && row.eventId === "fix2-blocked")).toBe(true);
    expect(scene.edgeBundles.some((bundle) => bundle.edgeType === "handoff")).toBe(true);
    expect(scene.edgeBundles.every((bundle) => bundle.sourceLaneId !== bundle.targetLaneId)).toBe(true);
  });

  it("derives factual summary strip values for the waiting chain", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    const scene = buildGraphSceneModel(
      dataset,
      { agentId: null, eventType: "all", search: "", errorOnly: false },
      { kind: "event", id: "fix2-blocked" },
    );
    const facts = buildSummaryFacts(dataset, scene.selectionPath);

    expect(facts.find((fact) => fact.label === "Blocked by")?.value).toBe("Planner");
    expect(facts.find((fact) => fact.label === "Last handoff")?.value).toContain("Planner");
  });

  it("derives causal inspector copy from the selected event", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    const summary = buildInspectorCausalSummary(dataset, { kind: "event", id: "fix2-blocked" }, false);
    expect(summary?.whyBlocked).toMatch(/Spec approval missing/i);
    expect(summary?.downstream.some((item) => item.label === "handoff target")).toBe(true);
  });

  it("shows model fact for non-llm events and hides it for human", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    // Select a non-llm event (the blocked planner event is eventType "llm.started" already,
    // so find a tool or note event)
    const toolEvent = dataset.events.find((e) => e.eventType === "tool.started");
    if (toolEvent) {
      const summary = buildInspectorCausalSummary(dataset, { kind: "event", id: toolEvent.eventId }, false);
      expect(summary).not.toBeNull();
      // Model fact should now be present for non-llm events
      const modelFact = summary?.facts.find((f) => f.label === "Model");
      expect(modelFact).toBeDefined();
    }

    // User prompt events (model = "human") should NOT show model fact
    const userEvent = dataset.events.find((e) => e.model === "human");
    if (userEvent) {
      const summary = buildInspectorCausalSummary(dataset, { kind: "event", id: userEvent.eventId }, false);
      const modelFact = summary?.facts.find((f) => f.label === "Model");
      expect(modelFact).toBeUndefined();
    }
  });

  it("derives causal inspector copy from an edge selection", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    const summary = buildInspectorCausalSummary(dataset, { kind: "edge", id: "edge-fix2-handoff" }, false);
    expect(summary?.title).toBe("handoff");
    expect(summary?.upstream[0]?.label).toBe("Source event");
    expect(summary?.downstream[0]?.label).toBe("Target event");
  });

  it("builds a workspace tree model with workspace-first grouping", () => {
    const model = buildWorkspaceTreeModel(FIXTURE_DATASETS, "", "all");
    expect(model.workspaces.length).toBeGreaterThan(0);
    expect(model.workspaces[0]?.threads.length).toBeGreaterThan(0);
    expect(model.workspaces[0]?.threads[0]?.runs.length).toBeGreaterThan(0);
  });

  it("merges worktrees that resolve to the same origin workspace", () => {
    const fix4 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-004");
    const fix5 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-005");

    expect(fix4).toBeDefined();
    expect(fix5).toBeDefined();
    if (!fix4 || !fix5) {
      throw new Error("fixtures for workspace merge test missing");
    }

    const model = buildWorkspaceTreeModel([fix4, fix5], "", "all", {
      [fix4.project.repoPath]: {
        originPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
        displayName: "codex-multi-agent-monitor",
        isWorktree: true,
      },
      [fix5.project.repoPath]: {
        originPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
        displayName: "codex-multi-agent-monitor",
        isWorktree: true,
      },
    });

    expect(model.workspaces).toHaveLength(1);
    expect(model.workspaces[0]?.name).toBe("codex-multi-agent-monitor");
    expect(model.workspaces[0]?.runCount).toBe(2);
  });

  it("keeps project grouping when origin resolution is absent", () => {
    const fix4 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-004");
    const fix5 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-005");

    expect(fix4).toBeDefined();
    expect(fix5).toBeDefined();
    if (!fix4 || !fix5) {
      throw new Error("fixtures for workspace fallback test missing");
    }

    const model = buildWorkspaceTreeModel([fix4, fix5], "", "all");
    expect(model.workspaces).toHaveLength(2);
  });

  it("searches both resolved origin names and original payload names", () => {
    const fix4 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-004");
    expect(fix4).toBeDefined();
    if (!fix4) {
      throw new Error("fixture for workspace search test missing");
    }

    const overrides = {
      [fix4.project.repoPath]: {
        originPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
        displayName: "codex-multi-agent-monitor",
        isWorktree: true,
      },
    };

    expect(buildWorkspaceTreeModel([fix4], "codex-multi-agent-monitor", "all", overrides).workspaces).toHaveLength(1);
    expect(buildWorkspaceTreeModel([fix4], fix4.project.name, "all", overrides).workspaces).toHaveLength(1);
  });

  it("prefers the first user input preview for the sidebar run title", () => {
    const fix5 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-005");
    expect(fix5).toBeDefined();
    if (!fix5) {
      throw new Error("fixture for sidebar title test missing");
    }

    const model = buildWorkspaceTreeModel([fix5], "", "all");
    const runTitle = model.workspaces[0]?.threads[0]?.runs[0]?.title;

    expect(runTitle).toBe("outline migration plan");
  });

  it("falls back to the session title when no user input preview is available", () => {
    const fix2 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(fix2).toBeDefined();
    if (!fix2) {
      throw new Error("fixture for sidebar session fallback test missing");
    }

    const model = buildWorkspaceTreeModel([fix2], "", "all");
    const runTitle = model.workspaces[0]?.threads[0]?.runs[0]?.title;

    expect(runTitle).toBe("Waiting chain review");
  });

  it("searches displayed run titles derived from the first user input", () => {
    const fix5 = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-005");
    expect(fix5).toBeDefined();
    if (!fix5) {
      throw new Error("fixture for sidebar title search test missing");
    }

    const model = buildWorkspaceTreeModel([fix5], "outline migration plan", "all");
    expect(model.workspaces).toHaveLength(1);
    expect(model.workspaces[0]?.threads[0]?.runs[0]?.title).toBe("outline migration plan");
  });

  it("orders runs within a thread by latest activity instead of alphabetical title order", () => {
    const source = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-005");
    expect(source).toBeDefined();
    if (!source) {
      throw new Error("fixture for workspace ordering test missing");
    }

    const shiftDataset = (traceId: string, title: string, offsetMs: number) => ({
      ...source,
      session: {
        ...source.session,
        sessionId: "thread-order-test",
        title,
      },
      run: {
        ...source.run,
        traceId,
        title,
        startTs: source.run.startTs + offsetMs,
        endTs: source.run.endTs ? source.run.endTs + offsetMs : source.run.endTs,
      },
      events: source.events.map((event) => ({
        ...event,
        eventId: `${traceId}:${event.eventId}`,
        startTs: event.startTs + offsetMs,
        endTs: event.endTs ? event.endTs + offsetMs : event.endTs,
        inputPreview: null,
      })),
      edges: source.edges.map((edge) => ({
        ...edge,
        edgeId: `${traceId}:${edge.edgeId}`,
        sourceEventId: `${traceId}:${edge.sourceEventId}`,
        targetEventId: `${traceId}:${edge.targetEventId}`,
      })),
      artifacts: source.artifacts.map((artifact) => ({
        ...artifact,
        artifactId: `${traceId}:${artifact.artifactId}`,
        producerEventId: `${traceId}:${artifact.producerEventId}`,
      })),
    });

    const olderRun = shiftDataset("trace-order-old", "Alpha older run", 0);
    const newerRun = shiftDataset("trace-order-new", "Zulu newer run", 60_000);
    const model = buildWorkspaceTreeModel([olderRun, newerRun], "", "all");
    const runs = model.workspaces[0]?.threads[0]?.runs;

    expect(runs).toBeDefined();
    expect(runs?.map((run) => run.title)).toEqual(["Zulu newer run", "Alpha older run"]);
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
