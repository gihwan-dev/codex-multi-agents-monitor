import { describe, expect, it } from "vitest";
import {
  buildDatasetFromSessionLog,
  deriveSessionLogStatus,
  deriveSessionLogTitle,
  NEW_THREAD_TITLE,
  type SessionLogSnapshot,
  type SubagentSnapshot,
} from "../src/app/sessionLogLoader.js";

function buildSnapshot(messages: SessionLogSnapshot["messages"]): SessionLogSnapshot {
  return {
    sessionId: "session-1",
    workspacePath: "/Users/choegihwan/Documents/Projects/exem-ui",
    originPath: "/Users/choegihwan/Documents/Projects/exem-ui",
    displayName: "exem-ui",
    startedAt: "2026-03-09T15:03:12.000Z",
    updatedAt: "2026-03-09T15:13:12.000Z",
    messages,
  };
}

describe("sessionLogLoader", () => {
  it("ignores AGENTS noise and keeps the first real user prompt as the title", () => {
    const title = deriveSessionLogTitle([
      {
        timestamp: "2026-03-09T15:03:12.000Z",
        role: "user",
        text: "# AGENTS.md instructions for /Users/choegihwan/Documents/Projects/exem-ui",
      },
      {
        timestamp: "2026-03-09T15:03:18.000Z",
        role: "user",
        text: "사이드바 UI 개선해주라. 이미지 처럼 단순한 그냥 트리 구조로.",
      },
    ]);

    expect(title).toBe("사이드바 UI 개선해주라. 이미지 처럼 단순한 그냥 트리 구조로.");
  });

  it("flattens markdown skill links into the visible chat title form", () => {
    const title = deriveSessionLogTitle([
      {
        timestamp: "2026-03-09T15:03:12.000Z",
        role: "user",
        text: "[$design-task](/Users/choegihwan/Documents/Projects/claude-setup/skills/design-task/SKILL.md) 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
      },
    ]);

    expect(title).toBe(
      "design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
  });

  it("falls back to 새 스레드 when the session only contains automation boilerplate", () => {
    const title = deriveSessionLogTitle([
      {
        timestamp: "2026-03-14T14:50:03.000Z",
        role: "user",
        text: "Automation: Dialy Diary Automation\n# Daily Diary\nAI 에이전트 활동 로그와 Obsidian 볼트 변경사항을 종합하여 Daily Notes에 일기를 자동 생성한다.",
      },
    ]);

    expect(title).toBe(NEW_THREAD_TITLE);
  });

  it("marks sessions with a trailing user turn as running", () => {
    const status = deriveSessionLogStatus([
      {
        timestamp: "2026-03-15T00:54:44.000Z",
        role: "assistant",
        text: "이전 수정은 반영했습니다.",
      },
      {
        timestamp: "2026-03-15T01:00:00.000Z",
        role: "user",
        text: "지금 내 눈에 보이는 채팅 제목은 1. 사이드바 UI 개선해주라. ~",
      },
    ]);

    expect(status).toBe("running");
  });

  it("filters out subagent_notification system messages from timeline events", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        {
          timestamp: "2026-03-09T15:03:18.000Z",
          role: "user",
          text: "큰 작업을 해야한다면...",
        },
        {
          timestamp: "2026-03-09T15:14:12.472Z",
          role: "user",
          text: "<subagent_notification>Agent A completed task</subagent_notification>",
        },
        {
          timestamp: "2026-03-09T15:14:12.472Z",
          role: "user",
          text: "<subagent_notification>Agent B completed task</subagent_notification>",
        },
        {
          timestamp: "2026-03-09T15:15:00.000Z",
          role: "assistant",
          text: "완료했습니다.",
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    const noteEvents = dataset!.events.filter((e) => e.eventType === "note");
    expect(noteEvents).toHaveLength(2);
    expect(noteEvents.every((e) => !e.inputPreview?.includes("<subagent_notification>"))).toBe(true);
  });

  it("generates unique eventIds for messages with identical timestamp and role", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        {
          timestamp: "2026-03-09T15:03:18.000Z",
          role: "user",
          text: "첫 번째 질문",
        },
        {
          timestamp: "2026-03-09T15:05:00.000Z",
          role: "assistant",
          text: "답변 A",
        },
        {
          timestamp: "2026-03-09T15:05:00.000Z",
          role: "assistant",
          text: "답변 B",
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    const noteEvents = dataset!.events.filter((e) => e.eventType === "note");
    const eventIds = noteEvents.map((e) => e.eventId);
    const uniqueIds = new Set(eventIds);
    expect(uniqueIds.size).toBe(eventIds.length);
  });

  it("skips turn_aborted and skill system messages from timeline events", () => {
    const status = deriveSessionLogStatus([
      {
        timestamp: "2026-03-15T00:54:44.000Z",
        role: "assistant",
        text: "작업 완료했습니다.",
      },
      {
        timestamp: "2026-03-15T01:00:00.000Z",
        role: "user",
        text: "<turn_aborted>user cancelled</turn_aborted>",
      },
    ]);

    expect(status).toBe("interrupted");
  });

  it("builds a minimal RunDataset with the derived sidebar title", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        {
          timestamp: "2026-03-09T15:03:12.000Z",
          role: "user",
          text: "# AGENTS.md instructions for /Users/choegihwan/Documents/Projects/exem-ui",
        },
        {
          timestamp: "2026-03-09T15:03:18.000Z",
          role: "user",
          text: "[$design-task](/Users/choegihwan/Documents/Projects/claude-setup/skills/design-task/SKILL.md) 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
        },
        {
          timestamp: "2026-03-09T15:05:00.000Z",
          role: "assistant",
          text: "작업 계획을 정리하겠습니다.",
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    expect(dataset?.project.name).toBe("exem-ui");
    expect(dataset?.run.title).toBe(
      "design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
    expect(dataset?.events.find((event) => event.inputPreview)?.inputPreview).toBe(
      "design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
  });
});

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
      messages: [
        {
          timestamp: "2026-03-15T10:02:05.000Z",
          role: "user",
          text: "PLEASE IMPLEMENT THIS PLAN: Research the historical context of the project",
        },
        {
          timestamp: "2026-03-15T10:10:00.000Z",
          role: "assistant",
          text: "연구 결과를 정리했습니다.",
        },
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
      messages: [
        {
          timestamp: "2026-03-15T10:02:35.000Z",
          role: "user",
          text: "PLEASE IMPLEMENT THIS PLAN: Implement the API layer for the new feature",
        },
        {
          timestamp: "2026-03-15T10:18:00.000Z",
          role: "assistant",
          text: "API 레이어 구현을 완료했습니다.",
        },
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
      messages: [
        {
          timestamp: "2026-03-15T10:03:05.000Z",
          role: "user",
          text: "PLEASE IMPLEMENT THIS PLAN: Write comprehensive tests for the new feature",
        },
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
    messages: [
      {
        timestamp: "2026-03-15T10:00:05.000Z",
        role: "user",
        text: "만약 너가 엄청나게 큰 작업을 받게 된다면 서브에이전트를 생성해서 병렬로 처리해.",
      },
      {
        timestamp: "2026-03-15T10:01:00.000Z",
        role: "assistant",
        text: "작업을 분석하고 3개의 서브에이전트를 생성하겠습니다.",
      },
    ],
    subagents,
  };
}

describe("multi-agent data pipeline", () => {
  it("generates 4 lanes, 3 spawn events, 3 spawn edges, and subagent message events", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    expect(dataset.lanes).toHaveLength(4);

    const spawnEvents = dataset.events.filter((e) => e.eventType === "agent.spawned");
    expect(spawnEvents).toHaveLength(3);

    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    expect(spawnEdges).toHaveLength(3);

    const humeNotes = dataset.events.filter(
      (e) => e.eventType === "note" && e.laneId === "sub-hume:sub",
    );
    expect(humeNotes.length).toBeGreaterThanOrEqual(1);

    const pasteurNotes = dataset.events.filter(
      (e) => e.eventType === "note" && e.laneId === "sub-pasteur:sub",
    );
    expect(pasteurNotes.length).toBeGreaterThanOrEqual(1);

    const gibbsNotes = dataset.events.filter(
      (e) => e.eventType === "note" && e.laneId === "sub-gibbs:sub",
    );
    expect(gibbsNotes.length).toBeGreaterThanOrEqual(1);
  });

  it("includes IMPLEMENT_PLAN user messages as events for subagent lanes", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const humeUserEvents = dataset.events.filter(
      (e) =>
        e.eventType === "note" &&
        e.laneId === "sub-hume:sub" &&
        e.title === "User prompt",
    );
    expect(humeUserEvents.length).toBeGreaterThanOrEqual(1);
    // First user message uses displayTitle (agentNickname) as inputPreview
    expect(humeUserEvents[0].inputPreview).toBe("Hume");

    // Spawn events exist independently of buildLaneEvents
    const spawnEvents = dataset.events.filter(
      (e) => e.eventType === "agent.spawned" && e.laneId === "sub-hume:sub",
    );
    expect(spawnEvents).toHaveLength(1);
  });

  it("assigns correct laneId to every subagent event", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const subLaneIds = new Set(
      dataset.lanes
        .filter((l) => l.badge === "Subagent")
        .map((l) => l.laneId),
    );
    expect(subLaneIds.size).toBe(3);

    const subEvents = dataset.events.filter((e) => subLaneIds.has(e.laneId));
    for (const event of subEvents) {
      expect(subLaneIds.has(event.laneId)).toBe(true);
      expect(event.agentId).toBe(event.laneId);
    }
  });

  it("derives running status for subagent with only IMPLEMENT_PLAN user message", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const gibbsLane = dataset.lanes.find((l) => l.laneId === "sub-gibbs:sub");
    expect(gibbsLane).toBeDefined();
    expect(gibbsLane!.laneStatus).toBe("running");
  });

  it("derives done status for subagent with assistant response after IMPLEMENT_PLAN", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const humeLane = dataset.lanes.find((l) => l.laneId === "sub-hume:sub");
    expect(humeLane).toBeDefined();
    expect(humeLane!.laneStatus).toBe("done");
  });

  it("marks subagent with error as interrupted and sets spawn event to failed", () => {
    const snapshot = buildMultiAgentSnapshot();
    const errorSub: SubagentSnapshot = {
      sessionId: "sub-error",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "ErrorAgent",
      agentRole: "worker",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:04:00.000Z",
      updatedAt: "2026-03-15T10:04:01.000Z",
      messages: [],
      error: "Rate limit exceeded: too many requests",
    };
    snapshot.subagents = [...(snapshot.subagents ?? []), errorSub];

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const errorLane = dataset.lanes.find((l) => l.laneId === "sub-error:sub");
    expect(errorLane).toBeDefined();
    expect(errorLane!.laneStatus).toBe("interrupted");

    const spawnEvent = dataset.events.find(
      (e) => e.eventType === "agent.spawned" && e.laneId === "sub-error:sub",
    );
    expect(spawnEvent).toBeDefined();
    expect(spawnEvent!.status).toBe("failed");
    expect(spawnEvent!.errorMessage).toBe("Rate limit exceeded: too many requests");
  });

  it("marks subagent with no messages and no error as running", () => {
    const snapshot = buildMultiAgentSnapshot();
    const emptySub: SubagentSnapshot = {
      sessionId: "sub-empty",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "EmptyAgent",
      agentRole: "worker",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:05:00.000Z",
      updatedAt: "2026-03-15T10:05:01.000Z",
      messages: [],
    };
    snapshot.subagents = [...(snapshot.subagents ?? []), emptySub];

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const emptyLane = dataset.lanes.find((l) => l.laneId === "sub-empty:sub");
    expect(emptyLane).toBeDefined();
    expect(emptyLane!.laneStatus).toBe("running");
  });
});
