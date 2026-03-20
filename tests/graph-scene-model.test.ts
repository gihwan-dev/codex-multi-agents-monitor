import { describe, expect, it } from "vitest";
import {
  buildGraphSceneModel,
  FIXTURE_DATASETS,
  type RunFilters,
  type SelectionState,
} from "../src/entities/run/index.js";
import { buildDatasetFromSessionLog, type SessionEntrySnapshot, type SessionLogSnapshot, type SubagentSnapshot } from "../src/entities/session-log/index.js";
import {
  buildEventRects,
  computeLaneMetrics,
  computeVisibleRowRange,
} from "../src/widgets/causal-graph/index.js";

const DEFAULT_FILTERS: RunFilters = {
  agentId: null,
  eventType: "all",
  search: "",
  errorOnly: false,
};

function expectDefined<T>(value: T | null | undefined, message: string): T {
  expect(value).toBeDefined();
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function buildDefaultSelection(traceId: string): SelectionState | null {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset?.run.selectedByDefaultId) {
    return null;
  }
  return { kind: "event", id: dataset.run.selectedByDefaultId };
}

function expectDataset(snapshot: SessionLogSnapshot) {
  const dataset = buildDatasetFromSessionLog(snapshot);
  expect(dataset).not.toBeNull();
  if (!dataset) {
    throw new Error("expected graph scene dataset");
  }
  return dataset;
}

describe("buildGraphSceneModel", () => {
  it("builds sequence-friendly rows and cross-lane bundles for the waiting chain fixture", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    const scene = buildGraphSceneModel(
      dataset,
      DEFAULT_FILTERS,
      buildDefaultSelection("trace-fix-002"),
    );

    expect(scene.rows.some((row) => row.kind === "event" && row.eventId === "fix2-blocked")).toBe(true);
    expect(scene.edgeBundles.length).toBeGreaterThan(0);
    expect(scene.edgeBundles.every((bundle) => bundle.sourceLaneId !== bundle.targetLaneId)).toBe(true);
    expect(scene.latestVisibleEventId).toBe(
      [...scene.rows].reverse().find((row) => row.kind === "event")?.eventId ?? null,
    );
  });

  it("folds inactive done lanes for the dense parallel fixture while keeping the active path", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-004");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("dense-parallel fixture missing");
    }

    const scene = buildGraphSceneModel(
      dataset,
      DEFAULT_FILTERS,
      { kind: "event", id: "fix4-lane-1-0" },
    );

    expect(scene.hiddenLaneCount).toBeGreaterThan(0);
    expect(scene.lanes.length).toBeLessThan(dataset.lanes.length);
    expect(scene.rows.some((row) => row.kind === "event" && row.inPath)).toBe(true);
  });
});

function makeMessageEntry(
  timestamp: string,
  role: "user" | "assistant",
  text: string,
): SessionEntrySnapshot {
  return {
    timestamp,
    entryType: "message",
    role,
    text,
    functionName: null,
    functionCallId: null,
    functionArgumentsPreview: null,
  };
}

function buildMultiAgentSnapshot(): SessionLogSnapshot {
  const subagents: SubagentSnapshot[] = [
    {
      sessionId: "sub-hume",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "Hume",
      agentRole: "researcher",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:02:00.000Z",
      updatedAt: "2026-03-15T10:15:00.000Z",
      entries: [
        makeMessageEntry(
          "2026-03-15T10:02:05.000Z",
          "user",
          "PLEASE IMPLEMENT THIS PLAN: Research the historical context of the project",
        ),
        makeMessageEntry(
          "2026-03-15T10:10:00.000Z",
          "assistant",
          "연구 결과를 정리했습니다.",
        ),
      ],
    },
    {
      sessionId: "sub-pasteur",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "Pasteur",
      agentRole: "implementer",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:02:30.000Z",
      updatedAt: "2026-03-15T10:20:00.000Z",
      entries: [
        makeMessageEntry(
          "2026-03-15T10:02:35.000Z",
          "user",
          "PLEASE IMPLEMENT THIS PLAN: Implement the API layer for the new feature",
        ),
        makeMessageEntry(
          "2026-03-15T10:18:00.000Z",
          "assistant",
          "API 레이어 구현을 완료했습니다.",
        ),
      ],
    },
    {
      sessionId: "sub-gibbs",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "Gibbs",
      agentRole: "tester",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:03:00.000Z",
      updatedAt: "2026-03-15T10:03:30.000Z",
      entries: [
        makeMessageEntry(
          "2026-03-15T10:03:05.000Z",
          "user",
          "PLEASE IMPLEMENT THIS PLAN: Write comprehensive tests for the new feature",
        ),
      ],
    },
  ];

  return {
    sessionId: "multi-session-1",
    workspacePath: "/projects/test",
    originPath: "/projects/test",
    displayName: "multi-agent-test",
    startedAt: "2026-03-15T10:00:00.000Z",
    updatedAt: "2026-03-15T10:30:00.000Z",
    model: "claude-opus-4-6",
    entries: [
      makeMessageEntry(
        "2026-03-15T10:00:05.000Z",
        "user",
        "만약 너가 엄청나게 큰 작업을 받게 된다면 서브에이전트를 생성해서 병렬로 처리해.",
      ),
      makeMessageEntry(
        "2026-03-15T10:01:00.000Z",
        "assistant",
        "작업을 분석하고 3개의 서브에이전트를 생성하겠습니다.",
      ),
      {
        timestamp: "2026-03-15T10:01:55.000Z",
        entryType: "function_call",
        role: null,
        text: null,
        functionName: "spawn_agent",
        functionCallId: "call_spawn_1",
        functionArgumentsPreview: '{"agent_type":"researcher"}',
      },
      {
        timestamp: "2026-03-15T10:02:25.000Z",
        entryType: "function_call",
        role: null,
        text: null,
        functionName: "spawn_agent",
        functionCallId: "call_spawn_2",
        functionArgumentsPreview: '{"agent_type":"implementer"}',
      },
      {
        timestamp: "2026-03-15T10:02:55.000Z",
        entryType: "function_call",
        role: null,
        text: null,
        functionName: "spawn_agent",
        functionCallId: "call_spawn_3",
        functionArgumentsPreview: '{"agent_type":"tester"}',
      },
    ],
    subagents,
  };
}

function buildMultiAgentDataset() {
  return expectDataset(buildMultiAgentSnapshot());
}

describe("multi-agent scene model", () => {
  it("includes subagent spawn events in scene.rows", () => {
    const dataset = buildMultiAgentDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);

    const subLaneIds = dataset.lanes
      .filter((l) => l.badge === "Subagent")
      .map((l) => l.laneId);

    for (const subLaneId of subLaneIds) {
      const spawnRow = scene.rows.find(
        (row) => row.kind === "event" && row.laneId === subLaneId,
      );
      expect(spawnRow).toBeDefined();
    }
  });

  it("maps every event row laneId to a valid scene lane", () => {
    const dataset = buildMultiAgentDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);
    const sceneLaneIds = new Set(scene.lanes.map((l) => l.laneId));

    const eventRows = scene.rows.filter((row) => row.kind === "event");
    for (const row of eventRows) {
      if (row.kind === "event") {
        expect(sceneLaneIds.has(row.laneId)).toBe(true);
      }
    }
  });

  it("ensures spawn edge bundle endpoints exist in scene.rows", () => {
    const dataset = buildMultiAgentDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);

    const rowEventIds = new Set(
      scene.rows.filter((r) => r.kind === "event").map((r) => r.eventId),
    );
    const spawnBundles = scene.edgeBundles.filter((b) => b.edgeType === "spawn");
    expect(spawnBundles.length).toBe(3);

    for (const bundle of spawnBundles) {
      expect(rowEventIds.has(bundle.sourceEventId)).toBe(true);
      expect(rowEventIds.has(bundle.targetEventId)).toBe(true);
    }
  });

  it("keeps spawn topology inside the selection path for a focused subagent event", () => {
    const dataset = buildMultiAgentDataset();
    const focusedEvent = dataset.events.find(
      (event) => event.laneId === "sub-hume:sub" && event.eventType === "agent.spawned",
    );
    expect(focusedEvent).toBeDefined();
    if (!focusedEvent) {
      throw new Error("expected focused subagent spawn event");
    }

    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, {
      kind: "event",
      id: focusedEvent.eventId,
    });
    const spawnEdges = dataset.edges.filter((edge) => edge.edgeType === "spawn");

    expect(spawnEdges.length).toBe(3);

    for (const edge of spawnEdges) {
      expect(scene.selectionPath.edgeIds).toContain(edge.edgeId);
      expect(scene.selectionPath.eventIds).toContain(edge.sourceEventId);
      expect(scene.selectionPath.eventIds).toContain(edge.targetEventId);
    }
  });

  it("produces valid cardRect for subagent events in layout", () => {
    const dataset = buildMultiAgentDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);
    const laneMetrics = computeLaneMetrics(1200, scene.lanes.length);
    const layoutResult = buildEventRects(scene, laneMetrics);

    const subLaneIds = new Set(
      dataset.lanes.filter((l) => l.badge === "Subagent").map((l) => l.laneId),
    );

    const subEventRows = scene.rows.filter(
      (r) => r.kind === "event" && subLaneIds.has(r.laneId),
    );
    expect(subEventRows.length).toBeGreaterThan(0);

    for (const row of subEventRows) {
      if (row.kind !== "event") continue;
      const eventLayout = layoutResult.eventById.get(row.eventId);
      expect(eventLayout).toBeDefined();
      if (!eventLayout) continue;
      expect(eventLayout.cardRect.width).toBeGreaterThan(0);
      expect(eventLayout.cardRect.height).toBe(80);
    }
  });

  it("includes all subagent rows within virtual scroll range for sufficient viewport", () => {
    const dataset = buildMultiAgentDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);
    const laneMetrics = computeLaneMetrics(1200, scene.lanes.length);
    const layoutResult = buildEventRects(scene, laneMetrics);

    const range = computeVisibleRowRange(layoutResult.rowPositions, 0, 100_000, 3);

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(scene.rows.length);
  });
});

describe("merge edge scene integration", () => {
  function makeFunctionCallEntry(
    timestamp: string,
    functionName: string,
    callId: string,
    args: string,
  ): SessionEntrySnapshot {
    return {
      timestamp,
      entryType: "function_call",
      role: null,
      text: null,
      functionName,
      functionCallId: callId,
      functionArgumentsPreview: args,
    };
  }

  function makeFunctionCallOutputEntry(
    timestamp: string,
    callId: string,
    output: string,
  ): SessionEntrySnapshot {
    return {
      timestamp,
      entryType: "function_call_output",
      role: null,
      text: output,
      functionName: null,
      functionCallId: callId,
      functionArgumentsPreview: null,
    };
  }

  function buildMergeEdgeDataset() {
    const snapshot: SessionLogSnapshot = {
      sessionId: "merge-scene-1",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "merge-scene",
      startedAt: "2026-03-18T10:00:00.000Z",
      updatedAt: "2026-03-18T10:30:00.000Z",
      model: "claude-opus-4-6",
      entries: [
        makeMessageEntry("2026-03-18T10:00:05.000Z", "user", "병렬 작업 실행"),
        makeFunctionCallEntry(
          "2026-03-18T10:01:00.000Z",
          "spawn_agent",
          "sp1",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T10:01:05.000Z",
          "sp1",
          '{"agent_id":"cid-x","nickname":"AgentX"}',
        ),
        makeFunctionCallEntry(
          "2026-03-18T10:15:00.000Z",
          "close_agent",
          "cl1",
          '{"id":"cid-x"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T10:15:05.000Z",
          "cl1",
          '{"status":{"completed":"결과"}}',
        ),
      ],
      subagents: [
        {
          sessionId: "sub-x",
          parentThreadId: "merge-scene-1",
          depth: 1,
          agentNickname: "AgentX",
          agentRole: "worker",
          model: "claude-sonnet-4-6",
          startedAt: "2026-03-18T10:02:00.000Z",
          updatedAt: "2026-03-18T10:14:00.000Z",
          entries: [
            makeMessageEntry("2026-03-18T10:02:05.000Z", "assistant", "작업 완료."),
          ],
        },
      ],
    };
    const dataset = expectDataset(snapshot);
    if (!dataset) throw new Error("merge edge dataset build failed");
    return dataset;
  }

  it("includes merge edges in the graph scene edge bundles", () => {
    const dataset = buildMergeEdgeDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);

    const mergeBundles = scene.edgeBundles.filter(
      (b) => b.edgeType === "merge",
    );
    expect(mergeBundles.length).toBeGreaterThanOrEqual(1);
  });

  it("includes merge edge endpoints in selection path", () => {
    const dataset = buildMergeEdgeDataset();
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);

    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    expect(mergeEdges.length).toBeGreaterThanOrEqual(1);

    for (const edge of mergeEdges) {
      expect(scene.selectionPath.edgeIds).toContain(edge.edgeId);
      expect(scene.selectionPath.eventIds).toContain(edge.sourceEventId);
      expect(scene.selectionPath.eventIds).toContain(edge.targetEventId);
    }
  });

  it("merge and spawn edges coexist for the same subagent", () => {
    const dataset = buildMergeEdgeDataset();

    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");

    expect(spawnEdges).toHaveLength(1);
    expect(mergeEdges).toHaveLength(1);

    // Spawn goes parent→sub, merge goes sub→parent
    expect(spawnEdges[0].sourceAgentId).toBe("merge-scene-1:main");
    expect(spawnEdges[0].targetAgentId).toBe("sub-x:sub");
    expect(mergeEdges[0].sourceAgentId).toBe("sub-x:sub");
    expect(mergeEdges[0].targetAgentId).toBe("merge-scene-1:main");
  });
});

describe("errored subagent graph rendering", () => {
  function makeFunctionCallEntry(
    timestamp: string,
    functionName: string,
    callId: string,
    args: string,
  ): SessionEntrySnapshot {
    return {
      timestamp,
      entryType: "function_call",
      role: null,
      text: null,
      functionName,
      functionCallId: callId,
      functionArgumentsPreview: args,
    };
  }

  function makeFunctionCallOutputEntry(
    timestamp: string,
    callId: string,
    output: string,
  ): SessionEntrySnapshot {
    return {
      timestamp,
      entryType: "function_call_output",
      role: null,
      text: output,
      functionName: null,
      functionCallId: callId,
      functionArgumentsPreview: null,
    };
  }

  function makeAgentMessageEntry(timestamp: string, text: string): SessionEntrySnapshot {
    return {
      timestamp,
      entryType: "agent_message",
      role: null,
      text,
      functionName: null,
      functionCallId: null,
      functionArgumentsPreview: null,
    };
  }

  function buildErroredSubagentSnapshot(): SessionLogSnapshot {
    // Main session entries
    // Timestamps follow the real problematic pattern:
    //   spawn calls:   10:01:00, 10:01:01, 10:01:02
    //   spawn outputs: 10:01:05, 10:01:06, 10:01:07
    //   wait #1 call:  10:02:00  (IDs: Gibbs, Pasteur, Hume)
    //   wait #1 out:   10:02:30  (Gibbs errored)
    //   wait #2 call:  10:02:35  (IDs: Pasteur, Hume)
    //   wait #2 out:   10:02:40  (Pasteur, Hume completed:null)
    //   agent_message: 10:03:00
    //   exec_command:  10:03:30 / output 10:03:35
    //   agent_message: 10:05:00
    //   task_complete: 10:05:10
    //
    // Subagent startedAt timestamps are AFTER the wait call (10:02:00):
    //   Gibbs:   10:01:08  — starts slightly after spawn outputs
    //   Pasteur: 10:01:09
    //   Hume:    10:01:10
    // (This replicates the real pattern where wait_agent call ts < subagent startedAt)
    //
    // Subagent entries are empty (fork_context filtering removed parent entries).
    // Subagent model differs from parent to match real data pattern.
    const entries: SessionEntrySnapshot[] = [
      makeMessageEntry("2026-03-19T10:00:05.000Z", "user", "Run parallel research tasks with subagents"),
      makeMessageEntry("2026-03-19T10:00:30.000Z", "assistant", "Spawning 3 subagents for parallel execution."),
      // spawn_agent calls
      makeFunctionCallEntry("2026-03-19T10:01:00.000Z", "spawn_agent", "sp-gibbs", '{"agent_type":"researcher","nickname":"Gibbs"}'),
      makeFunctionCallEntry("2026-03-19T10:01:01.000Z", "spawn_agent", "sp-pasteur", '{"agent_type":"researcher","nickname":"Pasteur"}'),
      makeFunctionCallEntry("2026-03-19T10:01:02.000Z", "spawn_agent", "sp-hume", '{"agent_type":"researcher","nickname":"Hume"}'),
      // spawn_agent outputs — agent_id must match subagent sessionIds exactly
      makeFunctionCallOutputEntry("2026-03-19T10:01:05.000Z", "sp-gibbs", '{"agent_id":"sub-err-gibbs","nickname":"Gibbs"}'),
      makeFunctionCallOutputEntry("2026-03-19T10:01:06.000Z", "sp-pasteur", '{"agent_id":"sub-err-pasteur","nickname":"Pasteur"}'),
      makeFunctionCallOutputEntry("2026-03-19T10:01:07.000Z", "sp-hume", '{"agent_id":"sub-err-hume","nickname":"Hume"}'),
      // wait_agent #1 — CRITICAL: call timestamp 10:02:00 is BEFORE subagent startedAt (10:01:08-10:01:10)
      // but AFTER spawn outputs (10:01:05-10:01:07). This is the real problematic pattern.
      makeFunctionCallEntry("2026-03-19T10:02:00.000Z", "wait_agent", "wait-1", '{"ids":["sub-err-gibbs","sub-err-pasteur","sub-err-hume"]}'),
      makeFunctionCallOutputEntry("2026-03-19T10:02:30.000Z", "wait-1", '{"status":{"sub-err-gibbs":{"errored":"You\'ve hit your usage limit"},"sub-err-pasteur":{"completed":null},"sub-err-hume":{"completed":null}},"timed_out":false}'),
      // wait_agent #2 — collect remaining
      makeFunctionCallEntry("2026-03-19T10:02:35.000Z", "wait_agent", "wait-2", '{"ids":["sub-err-pasteur","sub-err-hume"]}'),
      makeFunctionCallOutputEntry("2026-03-19T10:02:40.000Z", "wait-2", '{"status":{"sub-err-pasteur":{"completed":null},"sub-err-hume":{"completed":null}},"timed_out":false}'),
      makeAgentMessageEntry("2026-03-19T10:03:00.000Z", "All agents have reported. Summarising results."),
      makeFunctionCallEntry("2026-03-19T10:03:30.000Z", "exec_command", "exec-1", '{"command":"cat /tmp/results.txt"}'),
      makeFunctionCallOutputEntry("2026-03-19T10:03:35.000Z", "exec-1", '{"stdout":"Research output collected.","exit_code":0}'),
      makeAgentMessageEntry("2026-03-19T10:05:00.000Z", "Task finalised. Gibbs hit usage limit but Pasteur and Hume completed."),
      {
        timestamp: "2026-03-19T10:05:10.000Z",
        entryType: "task_complete",
        role: null,
        text: "Task complete",
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
    ];

    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-err-gibbs",
        parentThreadId: "errored-session-1",
        depth: 1,
        agentNickname: "Gibbs",
        agentRole: "researcher",
        model: "gpt-5.4",
        startedAt: "2026-03-19T10:01:08.000Z",
        updatedAt: "2026-03-19T10:02:00.000Z",
        entries: [],
        // No error field: status derives from empty entries → "running"
      },
      {
        sessionId: "sub-err-pasteur",
        parentThreadId: "errored-session-1",
        depth: 1,
        agentNickname: "Pasteur",
        agentRole: "researcher",
        model: "gpt-5.4",
        startedAt: "2026-03-19T10:01:09.000Z",
        updatedAt: "2026-03-19T10:02:00.000Z",
        entries: [],
      },
      {
        sessionId: "sub-err-hume",
        parentThreadId: "errored-session-1",
        depth: 1,
        agentNickname: "Hume",
        agentRole: "researcher",
        model: "gpt-5.4",
        startedAt: "2026-03-19T10:01:10.000Z",
        updatedAt: "2026-03-19T10:02:00.000Z",
        entries: [],
      },
    ];

    return {
      sessionId: "errored-session-1",
      workspacePath: "/projects/research",
      originPath: "/projects/research",
      displayName: "errored-subagent-test",
      startedAt: "2026-03-19T10:00:00.000Z",
      updatedAt: "2026-03-19T10:05:15.000Z",
      model: "gpt-5.3",
      entries,
      subagents,
    };
  }

  it("produces a dataset with events for all lanes including errored subagents", () => {
    const dataset = expectDataset(buildErroredSubagentSnapshot());

    // 5 lanes: User + Main + 3 subagents
    expect(dataset.lanes).toHaveLength(5);

    // Main lane should have many events
    const mainEvents = dataset.events.filter((e) => e.laneId === "errored-session-1:main");
    expect(mainEvents.length).toBeGreaterThan(5);

    // Each subagent lane should have at least 1 event (agent.spawned)
    for (const sub of ["sub-err-gibbs", "sub-err-pasteur", "sub-err-hume"]) {
      const subEvents = dataset.events.filter((e) => e.laneId === `${sub}:sub`);
      expect(subEvents.length).toBeGreaterThanOrEqual(1);
    }

    // Should have 3 spawn edges
    expect(dataset.edges.filter((e) => e.edgeType === "spawn")).toHaveLength(3);
  });

  it("graph scene model has non-empty rows for errored subagents session", () => {
    const dataset = expectDataset(buildErroredSubagentSnapshot());

    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);

    // The graph MUST have rows (this verifies the graph is not empty)
    expect(scene.rows.length).toBeGreaterThan(0);

    // All visible lanes should be present
    expect(scene.lanes.length).toBe(5);

    // Spawn edge bundles should exist
    const spawnBundles = scene.edgeBundles.filter((b) => b.edgeType === "spawn");
    expect(spawnBundles.length).toBe(3);
  });

  it("all edges flow forward in time (no backward edges)", () => {
    const dataset = expectDataset(buildErroredSubagentSnapshot());

    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, null);
    const eventsById = new Map(dataset.events.map((e) => [e.eventId, e]));

    for (const bundle of scene.edgeBundles) {
      const source = eventsById.get(bundle.sourceEventId);
      const target = eventsById.get(bundle.targetEventId);
      if (!source || !target) continue;

      // Target timestamp must be >= source timestamp (forward flow)
      expect(target.startTs).toBeGreaterThanOrEqual(source.startTs);
    }
  });

  it("subagent lanes show correct status: errored from wait_agent vs running for empty entries", () => {
    const dataset = expectDataset(buildErroredSubagentSnapshot());

    const subLanes = dataset.lanes.filter((l) => l.badge === "Subagent");
    expect(subLanes).toHaveLength(3);

    // Gibbs errored via wait_agent → interrupted
    const gibbsLane = expectDefined(
      subLanes.find((l) => l.name === "Gibbs"),
      "missing Gibbs lane",
    );
    expect(gibbsLane.laneStatus).toBe("interrupted");

    // Pasteur and Hume have empty entries and no error → running
    const pasteurLane = expectDefined(
      subLanes.find((l) => l.name === "Pasteur"),
      "missing Pasteur lane",
    );
    const humeLane = expectDefined(
      subLanes.find((l) => l.name === "Hume"),
      "missing Hume lane",
    );
    expect(pasteurLane.laneStatus).toBe("running");
    expect(humeLane.laneStatus).toBe("running");
  });

  it("Gibbs spawn event shows failed status with error message from wait_agent", () => {
    const dataset = expectDataset(buildErroredSubagentSnapshot());

    const gibbsSpawn = expectDefined(
      dataset.events.find(
        (e) => e.eventType === "agent.spawned" && e.laneId === "sub-err-gibbs:sub",
      ),
      "missing Gibbs spawn event",
    );
    expect(gibbsSpawn.status).toBe("failed");
    expect(gibbsSpawn.errorMessage).toBe("You've hit your usage limit");
  });
});
