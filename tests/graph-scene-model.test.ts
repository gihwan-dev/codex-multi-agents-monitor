import { describe, expect, it } from "vitest";
import { buildDatasetFromSessionLog, type SessionEntrySnapshot, type SessionLogSnapshot, type SubagentSnapshot } from "../src/app/sessionLogLoader.js";
import { FIXTURE_DATASETS } from "../src/features/fixtures";
import {
  buildEventRects,
  computeLaneMetrics,
  computeVisibleRowRange,
} from "../src/features/run-detail/graph/graphLayout";
import { buildGraphSceneModel, type RunFilters, type SelectionState } from "../src/shared/domain";

const DEFAULT_FILTERS: RunFilters = {
  agentId: null,
  eventType: "all",
  search: "",
  errorOnly: false,
};

function buildDefaultSelection(traceId: string): SelectionState | null {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset?.run.selectedByDefaultId) {
    return null;
  }
  return { kind: "event", id: dataset.run.selectedByDefaultId };
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
      false,
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
      true,
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
  const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
  if (!dataset) throw new Error("multi-agent dataset build failed");
  return dataset;
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
    const dataset = buildDatasetFromSessionLog(snapshot);
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
