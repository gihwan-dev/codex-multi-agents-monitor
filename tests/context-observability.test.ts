import { describe, expect, it } from "vitest";
import {
  buildGraphSceneModel,
  focusContextObservability,
  type SelectionState,
} from "../src/entities/run/index.js";
import {
  buildDatasetFromSessionLog,
  type SessionEntrySnapshot,
  type SessionLogSnapshot,
  type SubagentSnapshot,
} from "../src/entities/session-log/index.js";

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

function makeFunctionCallEntry(
  timestamp: string,
  functionName: string,
  functionCallId: string,
  functionArgumentsPreview: string,
): SessionEntrySnapshot {
  return {
    timestamp,
    entryType: "function_call",
    role: null,
    text: null,
    functionName,
    functionCallId,
    functionArgumentsPreview,
  };
}

function makeTokenCountEntry(
  timestamp: string,
  payload: string,
): SessionEntrySnapshot {
  return {
    timestamp,
    entryType: "token_count",
    role: null,
    text: payload,
    functionName: null,
    functionCallId: null,
    functionArgumentsPreview: null,
  };
}

function makeCompactionEntry(timestamp: string, text: string): SessionEntrySnapshot {
  return {
    timestamp,
    entryType: "context_compacted",
    role: null,
    text,
    functionName: null,
    functionCallId: null,
    functionArgumentsPreview: null,
  };
}

function expectDataset(snapshot: SessionLogSnapshot) {
  const dataset = buildDatasetFromSessionLog(snapshot);
  expect(dataset).not.toBeNull();
  if (!dataset) {
    throw new Error("expected dataset");
  }
  return dataset;
}

function buildSelection(eventId: string): SelectionState {
  return { kind: "event", id: eventId };
}

function buildObservabilitySnapshot(): SessionLogSnapshot {
  const subagents: SubagentSnapshot[] = [
    {
      sessionId: "sub-hume",
      parentThreadId: "context-observability-1",
      depth: 1,
      agentNickname: "Hume",
      agentRole: "reviewer",
      model: "gpt-5.4",
      startedAt: "2026-03-18T10:00:10.000Z",
      updatedAt: "2026-03-18T10:00:40.000Z",
      entries: [
        makeMessageEntry(
          "2026-03-18T10:00:12.000Z",
          "user",
          "Review the plan and return a compressed summary.",
        ),
        makeMessageEntry(
          "2026-03-18T10:00:18.000Z",
          "assistant",
          "Initial review notes with broad observations.",
        ),
        makeTokenCountEntry(
          "2026-03-18T10:00:18.100Z",
          '{"last":{"in":500,"cached":0,"out":120,"reasoning":20,"total":620},"total":{"in":500,"cached":0,"out":120,"reasoning":20,"total":620}}',
        ),
        makeCompactionEntry(
          "2026-03-18T10:00:25.000Z",
          "10 messages compacted (3 user, 2 developer, 5 assistant)",
        ),
        makeMessageEntry(
          "2026-03-18T10:00:34.000Z",
          "assistant",
          "Compressed summary returned to main thread.",
        ),
        makeTokenCountEntry(
          "2026-03-18T10:00:34.100Z",
          '{"last":{"in":300,"cached":40,"out":60,"reasoning":0,"total":360},"total":{"in":300,"cached":40,"out":180,"reasoning":20,"total":980}}',
        ),
      ],
    },
  ];

  return {
    sessionId: "context-observability-1",
    workspacePath: "/projects/test",
    originPath: "/projects/test",
    displayName: "context-observability",
    startedAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-18T10:01:00.000Z",
    model: "gpt-5.4",
    maxContextWindowTokens: 1_000_000,
    entries: [
      makeMessageEntry(
        "2026-03-18T10:00:01.000Z",
        "user",
        "Investigate context pressure across lanes.",
      ),
      makeMessageEntry(
        "2026-03-18T10:00:05.000Z",
        "assistant",
        "I will delegate the review to a worker lane.",
      ),
      makeTokenCountEntry(
        "2026-03-18T10:00:05.100Z",
        '{"last":{"in":1200,"cached":300,"out":180,"reasoning":40,"total":1380},"total":{"in":1200,"cached":300,"out":180,"reasoning":40,"total":1380}}',
      ),
      makeFunctionCallEntry(
        "2026-03-18T10:00:08.000Z",
        "spawn_agent",
        "spawn-hume",
        '{"id":"sub-hume","agent_type":"reviewer","nickname":"Hume"}',
      ),
      makeTokenCountEntry(
        "2026-03-18T10:00:08.100Z",
        '{"last":{"in":1400,"cached":0,"out":20,"reasoning":0,"total":1420},"total":{"in":1400,"cached":0,"out":200,"reasoning":40,"total":2800}}',
      ),
      makeFunctionCallEntry(
        "2026-03-18T10:00:42.000Z",
        "wait_agent",
        "wait-hume",
        '{"ids":["sub-hume"]}',
      ),
    ],
    subagents,
  };
}

describe("context observability bundle", () => {
  it("carries maxContextWindowTokens into the normalized run", () => {
    const dataset = expectDataset(buildObservabilitySnapshot());

    expect(dataset.run.maxContextWindowTokens).toBe(1_000_000);
  });

  it("enriches graph rows and lane summaries from the shared observability model", () => {
    const dataset = expectDataset(buildObservabilitySnapshot());
    const selectedEvent = dataset.events.find(
      (event) =>
        event.laneId === "sub-hume:sub" &&
        event.outputPreview === "Compressed summary returned to main thread.",
    );

    expect(selectedEvent).toBeDefined();
    if (!selectedEvent) {
      throw new Error("expected selected subagent event");
    }

    const scene = buildGraphSceneModel(dataset, buildSelection(selectedEvent.eventId));
    const selectedRow = scene.rows.find(
      (row) => row.kind === "event" && row.eventId === selectedEvent.eventId,
    );

    expect(selectedRow).toBeDefined();
    if (!selectedRow || selectedRow.kind !== "event") {
      throw new Error("expected selected row");
    }

    expect(selectedRow.totalTokens).toBe(360);
    expect(selectedRow.contextWindowTokens).toBe(300);
    expect(selectedRow.hasCompaction).toBe(false);
    expect(selectedRow.cumulativeContextTokens).toBe(980);

    expect(scene.contextObservability.activeEventId).toBe(selectedEvent.eventId);
    expect(scene.contextObservability.activeSource).toBe("selection");
    expect(scene.contextObservability.activeContextWindowTokens).toBe(300);
    expect(scene.contextObservability.activeCumulativeContextTokens).toBe(980);
    expect(scene.contextObservability.maxContextWindowTokens).toBe(1_000_000);
    expect(scene.contextObservability.timelinePoints).toHaveLength(dataset.events.length);

    const mainLane = scene.contextObservability.laneSummaries.find(
      (lane) => lane.laneKind === "main",
    );
    const subLane = scene.contextObservability.laneSummaries.find(
      (lane) => lane.laneId === "sub-hume:sub",
    );

    expect(mainLane).toBeDefined();
    expect(subLane).toBeDefined();
    if (!mainLane || !subLane) {
      throw new Error("expected lane summaries");
    }

    expect(subLane.laneKind).toBe("reviewer");
    expect(subLane.inputTokens).toBe(800);
    expect(subLane.outputTokens).toBe(180);
    expect(subLane.contextImportedTokens).toBe(500);
    expect(subLane.contextReturnedTokens).toBe(60);
    expect(subLane.compactionCount).toBe(1);
    expect(subLane.estimatedMainContextSaved).toBe(120);
    expect(subLane.isSelected).toBe(true);
    expect(mainLane.contextReturnedTokens).toBe(0);

    const compactionRow = scene.rows.find(
      (row) => row.kind === "event" && row.hasCompaction,
    );
    expect(compactionRow).toBeDefined();
    if (!compactionRow || compactionRow.kind !== "event") {
      throw new Error("expected compaction row");
    }

    expect(compactionRow.contextWindowTokens).toBe(0);
  });

  it("re-focuses observability on a viewport event without rebuilding the base model", () => {
    const dataset = expectDataset(buildObservabilitySnapshot());
    const scene = buildGraphSceneModel(dataset, null);
    const viewportEvent = dataset.events.find(
      (event) => event.outputPreview === "I will delegate the review to a worker lane.",
    );

    expect(viewportEvent).toBeDefined();
    if (!viewportEvent) {
      throw new Error("expected viewport event");
    }

    const focused = focusContextObservability({
      observability: scene.contextObservability,
      activeEventId: viewportEvent.eventId,
      activeSource: "viewport",
    });
    const viewportPoint = focused.pointsByEventId.get(viewportEvent.eventId);

    expect(focused.activeEventId).toBe(viewportEvent.eventId);
    expect(focused.activeEventTitle).toBe(viewportEvent.title);
    expect(focused.activeSource).toBe("viewport");
    expect(focused.activeContextWindowTokens).toBe(
      viewportPoint?.contextWindowTokens ?? 0,
    );
    expect(focused.laneSummaries.find((lane) => lane.isSelected)?.laneKind).toBe("main");
  });

  it("carries forward the latest measured state and does not invent state before measurement", () => {
    const dataset = expectDataset(buildObservabilitySnapshot());
    const scene = buildGraphSceneModel(dataset, null);
    const startPoint = scene.contextObservability.timelinePoints.find(
      (point) => point.eventTitle === "Session started",
    );
    const trailingWaitEvent = dataset.events.find((event) => event.toolName === "wait_agent");

    expect(startPoint).toBeDefined();
    expect(trailingWaitEvent).toBeDefined();
    if (!startPoint || !trailingWaitEvent) {
      throw new Error("expected timeline points");
    }

    const waitPoint = scene.contextObservability.pointsByEventId.get(trailingWaitEvent.eventId);
    expect(waitPoint).toBeDefined();
    if (!waitPoint) {
      throw new Error("expected trailing wait point");
    }

    expect(startPoint.hasMeasuredContextState).toBe(false);
    expect(startPoint.hasMeasuredRuntimeUsage).toBe(false);
    expect(startPoint.contextWindowTokens).toBe(0);
    expect(startPoint.cumulativeContextTokens).toBe(0);

    expect(waitPoint.hasMeasuredContextState).toBe(true);
    expect(waitPoint.hasMeasuredRuntimeUsage).toBe(false);
    expect(waitPoint.contextWindowTokens).toBe(300);
    expect(waitPoint.cumulativeContextTokens).toBe(980);
  });
});
