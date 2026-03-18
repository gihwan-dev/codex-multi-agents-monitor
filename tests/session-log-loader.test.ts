import { describe, expect, it } from "vitest";
import {
  buildDatasetFromSessionLog,
  deriveArchiveIndexTitle,
  deriveSessionLogStatus,
  deriveSessionLogTitle,
  NEW_THREAD_TITLE,
  type SessionEntrySnapshot,
  type SessionLogSnapshot,
  type SubagentSnapshot,
} from "../src/app/sessionLogLoader.js";

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

function buildSnapshot(entries: SessionEntrySnapshot[]): SessionLogSnapshot {
  return {
    sessionId: "session-1",
    workspacePath: "/Users/choegihwan/Documents/Projects/exem-ui",
    originPath: "/Users/choegihwan/Documents/Projects/exem-ui",
    displayName: "exem-ui",
    startedAt: "2026-03-09T15:03:12.000Z",
    updatedAt: "2026-03-09T15:13:12.000Z",
    model: null,
    entries,
  };
}

describe("sessionLogLoader", () => {
  it("ignores AGENTS noise and keeps the first real user prompt as the title", () => {
    const title = deriveSessionLogTitle([
      makeMessageEntry(
        "2026-03-09T15:03:12.000Z",
        "user",
        "# AGENTS.md instructions for /Users/choegihwan/Documents/Projects/exem-ui",
      ),
      makeMessageEntry(
        "2026-03-09T15:03:18.000Z",
        "user",
        "사이드바 UI 개선해주라. 이미지 처럼 단순한 그냥 트리 구조로.",
      ),
    ]);

    expect(title).toBe("사이드바 UI 개선해주라. 이미지 처럼 단순한 그냥 트리 구조로.");
  });

  it("flattens markdown skill links into the visible chat title form", () => {
    const title = deriveSessionLogTitle([
      makeMessageEntry(
        "2026-03-09T15:03:12.000Z",
        "user",
        "[$design-task](/Users/choegihwan/Documents/Projects/claude-setup/skills/design-task/SKILL.md) 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
      ),
    ]);

    expect(title).toBe(
      "design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
  });

  it("falls back to 새 스레드 when the session only contains automation boilerplate", () => {
    const title = deriveSessionLogTitle([
      makeMessageEntry(
        "2026-03-14T14:50:03.000Z",
        "user",
        "Automation: Dialy Diary Automation\n# Daily Diary\nAI 에이전트 활동 로그와 Obsidian 볼트 변경사항을 종합하여 Daily Notes에 일기를 자동 생성한다.",
      ),
    ]);

    expect(title).toBe(NEW_THREAD_TITLE);
  });

  it("marks sessions with a trailing user turn as running", () => {
    const status = deriveSessionLogStatus([
      makeMessageEntry(
        "2026-03-15T00:54:44.000Z",
        "assistant",
        "이전 수정은 반영했습니다.",
      ),
      makeMessageEntry(
        "2026-03-15T01:00:00.000Z",
        "user",
        "지금 내 눈에 보이는 채팅 제목은 1. 사이드바 UI 개선해주라. ~",
      ),
    ]);

    expect(status).toBe("running");
  });

  it("filters out subagent_notification system messages from timeline events", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry(
          "2026-03-09T15:03:18.000Z",
          "user",
          "큰 작업을 해야한다면...",
        ),
        makeMessageEntry(
          "2026-03-09T15:14:12.472Z",
          "user",
          "<subagent_notification>Agent A completed task</subagent_notification>",
        ),
        makeMessageEntry(
          "2026-03-09T15:14:12.472Z",
          "user",
          "<subagent_notification>Agent B completed task</subagent_notification>",
        ),
        makeMessageEntry(
          "2026-03-09T15:15:00.000Z",
          "assistant",
          "완료했습니다.",
        ),
      ]),
    );

    expect(dataset).not.toBeNull();
    const userPrompts = dataset!.events.filter((e) => e.eventType === "user.prompt");
    const noteEvents = dataset!.events.filter((e) => e.eventType === "note");
    // 1 user prompt (subagent_notifications are filtered out)
    expect(userPrompts).toHaveLength(1);
    // 1 assistant note
    expect(noteEvents).toHaveLength(1);
    expect(userPrompts.every((e) => !e.inputPreview?.includes("<subagent_notification>"))).toBe(true);
  });

  it("generates unique eventIds for entries with identical timestamp and entryType", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry(
          "2026-03-09T15:03:18.000Z",
          "user",
          "첫 번째 질문",
        ),
        makeMessageEntry(
          "2026-03-09T15:05:00.000Z",
          "assistant",
          "답변 A",
        ),
        makeMessageEntry(
          "2026-03-09T15:05:00.000Z",
          "assistant",
          "답변 B",
        ),
      ]),
    );

    expect(dataset).not.toBeNull();
    const contentEvents = dataset!.events.filter(
      (e) => e.eventType === "note" || e.eventType === "user.prompt",
    );
    const eventIds = contentEvents.map((e) => e.eventId);
    const uniqueIds = new Set(eventIds);
    expect(uniqueIds.size).toBe(eventIds.length);
  });

  it("skips turn_aborted entries and detects interrupted status", () => {
    const status = deriveSessionLogStatus([
      makeMessageEntry(
        "2026-03-15T00:54:44.000Z",
        "assistant",
        "작업 완료했습니다.",
      ),
      {
        timestamp: "2026-03-15T01:00:00.000Z",
        entryType: "turn_aborted",
        role: null,
        text: "user cancelled",
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
    ]);

    expect(status).toBe("interrupted");
  });

  it("builds a minimal RunDataset with the derived sidebar title", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry(
          "2026-03-09T15:03:12.000Z",
          "user",
          "# AGENTS.md instructions for /Users/choegihwan/Documents/Projects/exem-ui",
        ),
        makeMessageEntry(
          "2026-03-09T15:03:18.000Z",
          "user",
          "[$design-task](/Users/choegihwan/Documents/Projects/claude-setup/skills/design-task/SKILL.md) 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
        ),
        makeMessageEntry(
          "2026-03-09T15:05:00.000Z",
          "assistant",
          "작업 계획을 정리하겠습니다.",
        ),
      ]),
    );

    expect(dataset).not.toBeNull();
    expect(dataset?.project.name).toBe("exem-ui");
    expect(dataset?.run.title).toBe(
      "design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
    const userPrompt = dataset?.events.find((event) => event.eventType === "user.prompt");
    expect(userPrompt?.inputPreview).toBe(
      "design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
  });

  it("generates tool.started from function_call entries", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-09T15:03:18.000Z", "user", "파일 목록 보여줘"),
        {
          timestamp: "2026-03-09T15:04:00.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_1",
          functionArgumentsPreview: '{"command": "ls -la"}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    const toolStarted = dataset!.events.filter((e) => e.eventType === "tool.started");
    expect(toolStarted).toHaveLength(1);
    expect(toolStarted[0].title).toBe("exec_command");
    expect(toolStarted[0].toolName).toBe("exec_command");
  });

  it("generates tool.finished from function_call_output entries", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-09T15:03:18.000Z", "user", "파일 목록 보여줘"),
        {
          timestamp: "2026-03-09T15:04:00.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_1",
          functionArgumentsPreview: '{"command": "ls -la"}',
        },
        {
          timestamp: "2026-03-09T15:04:05.000Z",
          entryType: "function_call_output",
          role: null,
          text: "total 0\ndrwxr-xr-x 3 user staff",
          functionName: null,
          functionCallId: "call_1",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    const toolFinished = dataset!.events.filter((e) => e.eventType === "tool.finished");
    expect(toolFinished).toHaveLength(1);
    expect(toolFinished[0].toolName).toBe("exec_command");
    expect(toolFinished[0].title).toBe("exec_command result");
  });

  it("pairs tool.started and tool.finished by callId", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-09T15:03:18.000Z", "user", "테스트"),
        {
          timestamp: "2026-03-09T15:04:00.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_A",
          functionArgumentsPreview: '{"command": "echo hello"}',
        },
        {
          timestamp: "2026-03-09T15:04:01.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "apply_patch",
          functionCallId: "call_B",
          functionArgumentsPreview: '{"patch": "..."}',
        },
        {
          timestamp: "2026-03-09T15:04:05.000Z",
          entryType: "function_call_output",
          role: null,
          text: "hello",
          functionName: null,
          functionCallId: "call_A",
          functionArgumentsPreview: null,
        },
        {
          timestamp: "2026-03-09T15:04:06.000Z",
          entryType: "function_call_output",
          role: null,
          text: "patch applied",
          functionName: null,
          functionCallId: "call_B",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    const toolFinished = dataset!.events.filter((e) => e.eventType === "tool.finished");
    expect(toolFinished).toHaveLength(2);
    expect(toolFinished[0].toolName).toBe("exec_command");
    expect(toolFinished[1].toolName).toBe("apply_patch");
  });

  it("generates llm.started for reasoning entries", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-09T15:03:18.000Z", "user", "분석해줘"),
        {
          timestamp: "2026-03-09T15:04:00.000Z",
          entryType: "reasoning",
          role: null,
          text: null,
          functionName: null,
          functionCallId: null,
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    const reasoning = dataset!.events.filter((e) => e.eventType === "llm.started");
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0].title).toBe("Reasoning");
  });

  it("creates user lane and assigns user.prompt events", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-09T15:03:18.000Z", "user", "테스트 질문"),
        makeMessageEntry("2026-03-09T15:05:00.000Z", "assistant", "답변입니다."),
      ]),
    );

    expect(dataset).not.toBeNull();
    const userLane = dataset!.lanes.find((l) => l.role === "user");
    expect(userLane).toBeDefined();
    expect(userLane!.name).toBe("User");
    expect(userLane!.model).toBe("human");

    const userPrompts = dataset!.events.filter((e) => e.eventType === "user.prompt");
    expect(userPrompts).toHaveLength(1);
    expect(userPrompts[0].laneId).toBe(userLane!.laneId);

    const assistantNotes = dataset!.events.filter((e) => e.eventType === "note" && e.title === "Assistant");
    expect(assistantNotes).toHaveLength(1);
    expect(assistantNotes[0].laneId).toBe(dataset!.lanes.find((l) => l.role === "session")!.laneId);
  });

  it("subagent IMPLEMENT_PLAN shown as system instruction", () => {
    const snapshot = buildMultiAgentSnapshot();
    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const humeEvents = dataset.events.filter(
      (e) => e.laneId === "sub-hume:sub" && e.title === "System instruction",
    );
    expect(humeEvents.length).toBeGreaterThanOrEqual(1);
    expect(humeEvents[0].eventType).toBe("note");
  });
});

describe("deriveArchiveIndexTitle", () => {
  it("returns sanitized title from first user message", () => {
    const title = deriveArchiveIndexTitle("사이드바 UI 개선해주라");
    expect(title).toBe("사이드바 UI 개선해주라");
  });

  it("strips markdown links from message", () => {
    const title = deriveArchiveIndexTitle(
      "[$design-task](/path/to/skill) Table 컴포넌트 리팩토링",
    );
    expect(title).toBe("design-task Table 컴포넌트 리팩토링");
  });

  it("truncates long messages to 120 chars with ellipsis", () => {
    const longMessage = "가".repeat(200);
    const title = deriveArchiveIndexTitle(longMessage);
    expect(title).not.toBeNull();
    expect(title!.length).toBe(120);
    expect(title!.endsWith("...")).toBe(true);
  });

  it("returns null for null input", () => {
    expect(deriveArchiveIndexTitle(null)).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(deriveArchiveIndexTitle("   ")).toBeNull();
  });

  it("returns message as-is when exactly 120 chars", () => {
    const exact = "a".repeat(120);
    expect(deriveArchiveIndexTitle(exact)).toBe(exact);
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
    ],
    subagents,
  };
}

describe("multi-agent data pipeline", () => {
  it("generates lanes including user lane, main lane, and subagent lanes with spawn events and edges", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    // User lane + Main lane + 3 subagent lanes = 5
    expect(dataset.lanes).toHaveLength(5);

    const spawnEvents = dataset.events.filter((e) => e.eventType === "agent.spawned");
    expect(spawnEvents).toHaveLength(3);

    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    expect(spawnEdges).toHaveLength(3);

    const humeNotes = dataset.events.filter(
      (e) => e.laneId === "sub-hume:sub" && (e.eventType === "note" || e.eventType === "agent.spawned"),
    );
    expect(humeNotes.length).toBeGreaterThanOrEqual(1);
  });

  it("includes IMPLEMENT_PLAN user messages as system instruction events for subagent lanes", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const humeSystemEvents = dataset.events.filter(
      (e) =>
        e.eventType === "note" &&
        e.laneId === "sub-hume:sub" &&
        e.title === "System instruction",
    );
    expect(humeSystemEvents.length).toBeGreaterThanOrEqual(1);

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
      entries: [],
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

  it("classifies subagent user messages as delegated prompt, not user.prompt", () => {
    const snapshot = buildMultiAgentSnapshot();
    // 일반 user 메시지를 가진 서브에이전트 추가 (IMPLEMENT_PLAN 패턴 아님)
    const delegatedSub: SubagentSnapshot = {
      sessionId: "sub-delegate",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "Delegate",
      agentRole: "worker",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:06:00.000Z",
      updatedAt: "2026-03-15T10:10:00.000Z",
      entries: [
        makeMessageEntry(
          "2026-03-15T10:06:05.000Z",
          "user",
          "사이드바 UI 개선해주라. 이미지 처럼 단순한 그냥 트리 구조로.",
        ),
        makeMessageEntry(
          "2026-03-15T10:08:00.000Z",
          "assistant",
          "작업을 완료했습니다.",
        ),
      ],
    };
    snapshot.subagents = [...(snapshot.subagents ?? []), delegatedSub];

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const subLaneId = "sub-delegate:sub";

    // 서브에이전트 레인에 user.prompt 이벤트가 없어야 함
    const subUserPrompts = dataset.events.filter(
      (e) => e.laneId === subLaneId && e.eventType === "user.prompt",
    );
    expect(subUserPrompts).toHaveLength(0);

    // "Delegated prompt" note로 분류되어야 함
    const delegatedNotes = dataset.events.filter(
      (e) => e.laneId === subLaneId && e.title === "Delegated prompt",
    );
    expect(delegatedNotes).toHaveLength(1);
    expect(delegatedNotes[0].eventType).toBe("note");
    expect(delegatedNotes[0].outputPreview).toContain("사이드바 UI 개선해주라");
  });

  it("ensures no user.prompt events exist in any subagent lane", () => {
    const snapshot = buildMultiAgentSnapshot();
    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const subLaneIds = new Set(
      dataset.lanes
        .filter((l) => l.badge === "Subagent")
        .map((l) => l.laneId),
    );

    const subUserPrompts = dataset.events.filter(
      (e) => subLaneIds.has(e.laneId) && e.eventType === "user.prompt",
    );
    expect(subUserPrompts).toHaveLength(0);
  });

  it("marks subagent with no entries and no error as running", () => {
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
      entries: [],
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
