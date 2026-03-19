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

  it("marks user-only entries as done when task_complete follows", () => {
    const status = deriveSessionLogStatus([
      {
        timestamp: "2026-03-18T09:14:10.000Z",
        entryType: "task_started",
        role: null,
        text: null,
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
      makeMessageEntry(
        "2026-03-18T09:14:11.000Z",
        "user",
        "do stuff",
      ),
      {
        timestamp: "2026-03-18T09:14:30.000Z",
        entryType: "task_complete",
        role: null,
        text: null,
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
    ]);

    expect(status).toBe("done");
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

  it("context_compacted shows descriptive output preview", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Go"),
        {
          timestamp: "2026-03-19T10:05:00.000Z",
          entryType: "context_compacted",
          role: null,
          text: null,
          functionName: null,
          functionCallId: null,
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const compacted = dataset.events.find((e) => e.title === "Context compacted");
    expect(compacted).toBeDefined();
    expect(compacted!.eventType).toBe("note");
    expect(compacted!.outputPreview).toBe("Context reduced to fit within the model window");
  });

  it("turn_aborted shows reason in both outputPreview and errorMessage", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Go"),
        {
          timestamp: "2026-03-19T10:05:00.000Z",
          entryType: "turn_aborted",
          role: null,
          text: "interrupted",
          functionName: null,
          functionCallId: null,
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const aborted = dataset.events.find((e) => e.title === "Turn aborted");
    expect(aborted).toBeDefined();
    expect(aborted!.eventType).toBe("error");
    expect(aborted!.outputPreview).toBe("interrupted");
    expect(aborted!.errorMessage).toBe("interrupted");
  });

  it("thread_rolled_back shows reason in outputPreview", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Go"),
        {
          timestamp: "2026-03-19T10:05:00.000Z",
          entryType: "thread_rolled_back",
          role: null,
          text: null,
          functionName: null,
          functionCallId: null,
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const rolledBack = dataset.events.find((e) => e.title === "Thread rolled back");
    expect(rolledBack).toBeDefined();
    expect(rolledBack!.outputPreview).toBe("Thread rolled back");
    expect(rolledBack!.errorMessage).toBe("Thread rolled back");
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

  it("propagates errored status from wait_agent output to subagent", () => {
    const snapshot = buildMultiAgentSnapshot();

    // Add a wait_agent function_call and its output with an errored subagent
    snapshot.entries.push(
      {
        timestamp: "2026-03-15T10:05:00.000Z",
        entryType: "function_call",
        role: null,
        text: null,
        functionName: "wait_agent",
        functionCallId: "call_wait_1",
        functionArgumentsPreview: '{"ids":["sub-gibbs"],"timeout_ms":120000}',
      },
      {
        timestamp: "2026-03-15T10:05:30.000Z",
        entryType: "function_call_output",
        role: null,
        text: '{"status":{"sub-gibbs":{"errored":"You\'ve hit your usage limit"}},"timed_out":false}',
        functionName: null,
        functionCallId: "call_wait_1",
        functionArgumentsPreview: null,
      },
    );

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const gibbsLane = dataset.lanes.find((l) => l.laneId === "sub-gibbs:sub");
    expect(gibbsLane).toBeDefined();
    expect(gibbsLane!.laneStatus).toBe("interrupted");

    const spawnEvent = dataset.events.find(
      (e) => e.eventType === "agent.spawned" && e.laneId === "sub-gibbs:sub",
    );
    expect(spawnEvent).toBeDefined();
    expect(spawnEvent!.status).toBe("failed");
    expect(spawnEvent!.errorMessage).toBe("You've hit your usage limit");
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

  it("maps each spawn_agent function_call 1:1 to its corresponding subagent edge", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    expect(spawnEdges).toHaveLength(3);

    // 모든 spawn 엣지의 sourceEventId가 유니크해야 함
    const sourceIds = spawnEdges.map((e) => e.sourceEventId);
    expect(new Set(sourceIds).size).toBe(3);

    // 각 sourceEventId가 toolName === "spawn_agent"인 tool.started 이벤트여야 함
    for (const sourceId of sourceIds) {
      const evt = dataset.events.find((e) => e.eventId === sourceId);
      expect(evt).toBeDefined();
      expect(evt!.eventType).toBe("tool.started");
      expect(evt!.toolName).toBe("spawn_agent");
    }
  });

  it("classifies spawn_agent function_calls as tool.started, not agent.spawned", () => {
    const dataset = buildDatasetFromSessionLog(buildMultiAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const mainLaneId = "multi-session-1:main";

    // Main lane에 agent.spawned 이벤트가 없어야 함
    const mainSpawned = dataset.events.filter(
      (e) => e.laneId === mainLaneId && e.eventType === "agent.spawned",
    );
    expect(mainSpawned).toHaveLength(0);

    // spawn_agent toolName을 가진 tool.started 이벤트가 3개여야 함
    const spawnTools = dataset.events.filter(
      (e) => e.laneId === mainLaneId && e.eventType === "tool.started" && e.toolName === "spawn_agent",
    );
    expect(spawnTools).toHaveLength(3);
  });

  it("falls back to findClosestParentEvent when spawn count mismatches", () => {
    const snapshot = buildMultiAgentSnapshot();
    // 서브에이전트 4개, spawn_agent function_call 3개인 상황
    const extraSub: SubagentSnapshot = {
      sessionId: "sub-extra",
      parentThreadId: "multi-session-1",
      depth: 1,
      agentNickname: "ExtraAgent",
      agentRole: "worker",
      model: "claude-sonnet-4-6",
      startedAt: "2026-03-15T10:04:00.000Z",
      updatedAt: "2026-03-15T10:05:00.000Z",
      entries: [
        makeMessageEntry("2026-03-15T10:04:05.000Z", "assistant", "작업 완료."),
      ],
    };
    snapshot.subagents = [...(snapshot.subagents ?? []), extraSub];

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    expect(spawnEdges).toHaveLength(4);

    // 처음 3개는 1:1 매핑 → sourceEventId가 spawn_agent tool.started
    const mappedSources = spawnEdges
      .slice(0, 3)
      .map((e) => dataset.events.find((ev) => ev.eventId === e.sourceEventId));
    for (const src of mappedSources) {
      expect(src?.toolName).toBe("spawn_agent");
    }

    // 4번째는 fallback → sourceEventId가 존재하지만 spawn_agent가 아닐 수 있음
    const extraEdge = spawnEdges.find((e) => e.targetAgentId === "sub-extra:sub");
    expect(extraEdge).toBeDefined();
    expect(extraEdge!.sourceEventId).toBeTruthy();
  });
});

describe("merge edge generation", () => {
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

  function buildCloseAgentSnapshot(): SessionLogSnapshot {
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-alpha",
        parentThreadId: "merge-session-1",
        depth: 1,
        agentNickname: "Alpha",
        agentRole: "worker",
        model: "claude-sonnet-4-6",
        startedAt: "2026-03-18T10:02:00.000Z",
        updatedAt: "2026-03-18T10:15:00.000Z",
        entries: [
          makeMessageEntry("2026-03-18T10:02:05.000Z", "assistant", "작업 완료."),
        ],
      },
      {
        sessionId: "sub-beta",
        parentThreadId: "merge-session-1",
        depth: 1,
        agentNickname: "Beta",
        agentRole: "worker",
        model: "claude-sonnet-4-6",
        startedAt: "2026-03-18T10:02:30.000Z",
        updatedAt: "2026-03-18T10:20:00.000Z",
        entries: [
          makeMessageEntry("2026-03-18T10:02:35.000Z", "assistant", "분석 완료."),
        ],
      },
    ];

    return {
      sessionId: "merge-session-1",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "merge-test",
      startedAt: "2026-03-18T10:00:00.000Z",
      updatedAt: "2026-03-18T10:30:00.000Z",
      model: "claude-opus-4-6",
      entries: [
        makeMessageEntry("2026-03-18T10:00:05.000Z", "user", "큰 작업을 해줘"),
        makeFunctionCallEntry(
          "2026-03-18T10:01:00.000Z",
          "spawn_agent",
          "call_spawn_a",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T10:01:05.000Z",
          "call_spawn_a",
          '{"agent_id":"codex-id-alpha","nickname":"Alpha"}',
        ),
        makeFunctionCallEntry(
          "2026-03-18T10:01:10.000Z",
          "spawn_agent",
          "call_spawn_b",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T10:01:15.000Z",
          "call_spawn_b",
          '{"agent_id":"codex-id-beta","nickname":"Beta"}',
        ),
        makeFunctionCallEntry(
          "2026-03-18T10:20:00.000Z",
          "close_agent",
          "call_close_a",
          '{"id":"codex-id-alpha"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T10:20:05.000Z",
          "call_close_a",
          '{"status":{"completed":"작업 완료."}}',
        ),
        makeFunctionCallEntry(
          "2026-03-18T10:21:00.000Z",
          "close_agent",
          "call_close_b",
          '{"id":"codex-id-beta"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T10:21:05.000Z",
          "call_close_b",
          '{"status":{"completed":"분석 완료."}}',
        ),
      ],
      subagents,
    };
  }

  it("generates merge edges from close_agent function calls", () => {
    const dataset = buildDatasetFromSessionLog(buildCloseAgentSnapshot());
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    expect(mergeEdges).toHaveLength(2);

    // Each merge edge goes from subagent → parent
    for (const edge of mergeEdges) {
      expect(edge.sourceAgentId).toMatch(/^sub-(alpha|beta):sub$/);
      expect(edge.targetAgentId).toBe("merge-session-1:main");
    }

    // Source events should be from subagent lanes
    const sourceEvents = mergeEdges.map((e) =>
      dataset.events.find((ev) => ev.eventId === e.sourceEventId),
    );
    expect(sourceEvents.every((ev) => ev?.laneId.endsWith(":sub"))).toBe(true);

    // Target events should be close_agent events in main lane
    const targetEvents = mergeEdges.map((e) =>
      dataset.events.find((ev) => ev.eventId === e.targetEventId),
    );
    expect(targetEvents.every((ev) => ev?.toolName === "close_agent")).toBe(true);
  });

  it("generates merge edges from wait_agent function calls", () => {
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-gamma",
        parentThreadId: "wait-session-1",
        depth: 1,
        agentNickname: "Gamma",
        agentRole: "worker",
        model: "claude-sonnet-4-6",
        startedAt: "2026-03-18T11:02:00.000Z",
        updatedAt: "2026-03-18T11:10:00.000Z",
        entries: [
          makeMessageEntry("2026-03-18T11:02:05.000Z", "assistant", "완료."),
        ],
      },
      {
        sessionId: "sub-delta",
        parentThreadId: "wait-session-1",
        depth: 1,
        agentNickname: "Delta",
        agentRole: "worker",
        model: "claude-sonnet-4-6",
        startedAt: "2026-03-18T11:02:30.000Z",
        updatedAt: "2026-03-18T11:12:00.000Z",
        entries: [
          makeMessageEntry("2026-03-18T11:02:35.000Z", "assistant", "완료."),
        ],
      },
    ];

    const snapshot: SessionLogSnapshot = {
      sessionId: "wait-session-1",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "wait-test",
      startedAt: "2026-03-18T11:00:00.000Z",
      updatedAt: "2026-03-18T11:30:00.000Z",
      model: "claude-opus-4-6",
      entries: [
        makeMessageEntry("2026-03-18T11:00:05.000Z", "user", "병렬 처리해줘"),
        makeFunctionCallEntry(
          "2026-03-18T11:01:00.000Z",
          "spawn_agent",
          "call_sp_g",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T11:01:05.000Z",
          "call_sp_g",
          '{"agent_id":"cid-gamma","nickname":"Gamma"}',
        ),
        makeFunctionCallEntry(
          "2026-03-18T11:01:10.000Z",
          "spawn_agent",
          "call_sp_d",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T11:01:15.000Z",
          "call_sp_d",
          '{"agent_id":"cid-delta","nickname":"Delta"}',
        ),
        makeFunctionCallEntry(
          "2026-03-18T11:15:00.000Z",
          "wait_agent",
          "call_wait_1",
          '{"ids":["cid-gamma","cid-delta"],"timeout_ms":120000}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T11:15:05.000Z",
          "call_wait_1",
          '{"status":{"cid-gamma":"completed","cid-delta":"completed"}}',
        ),
      ],
      subagents,
    };

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    expect(mergeEdges).toHaveLength(2);

    // Both merge edges should target the wait_agent event
    const targetEvents = mergeEdges.map((e) =>
      dataset.events.find((ev) => ev.eventId === e.targetEventId),
    );
    expect(targetEvents.every((ev) => ev?.toolName === "wait_agent")).toBe(true);
  });

  it("generates merge edges from old-style wait function calls", () => {
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-old",
        parentThreadId: "old-session-1",
        depth: 1,
        agentNickname: "OldAgent",
        agentRole: "worker",
        model: "gpt-5",
        startedAt: "2026-02-23T10:02:00.000Z",
        updatedAt: "2026-02-23T10:10:00.000Z",
        entries: [
          makeMessageEntry("2026-02-23T10:02:05.000Z", "assistant", "완료."),
        ],
      },
    ];

    const snapshot: SessionLogSnapshot = {
      sessionId: "old-session-1",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "old-wait-test",
      startedAt: "2026-02-23T10:00:00.000Z",
      updatedAt: "2026-02-23T10:30:00.000Z",
      model: "gpt-5",
      entries: [
        makeMessageEntry("2026-02-23T10:00:05.000Z", "user", "작업 시작"),
        makeFunctionCallEntry(
          "2026-02-23T10:01:00.000Z",
          "spawn_agent",
          "call_sp_old",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-02-23T10:01:05.000Z",
          "call_sp_old",
          '{"agent_id":"cid-old","nickname":"OldAgent"}',
        ),
        makeFunctionCallEntry(
          "2026-02-23T10:12:00.000Z",
          "wait",
          "call_wait_old",
          '{"ids":["cid-old"],"timeout":120}',
        ),
        makeFunctionCallOutputEntry(
          "2026-02-23T10:12:05.000Z",
          "call_wait_old",
          "null",
        ),
        makeFunctionCallEntry(
          "2026-02-23T10:13:00.000Z",
          "close_agent",
          "call_close_old",
          '{"id":"cid-old"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-02-23T10:13:05.000Z",
          "call_close_old",
          '{"status":{"completed":"완료."}}',
        ),
      ],
      subagents,
    };

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    // Deduplication: 1 merge edge per subagent (close_agent wins as the last event)
    expect(mergeEdges).toHaveLength(1);

    const closeMerge = mergeEdges.find((e) => e.edgeId.includes("close"));
    expect(closeMerge).toBeDefined();
  });

  it("handles wait/wait_agent as tool.started with waiting for agents title", () => {
    const snapshot = buildCloseAgentSnapshot();
    // Add a wait_agent entry
    snapshot.entries.push(
      makeFunctionCallEntry(
        "2026-03-18T10:22:00.000Z",
        "wait_agent",
        "call_wait_final",
        '{"ids":["codex-id-alpha"],"timeout_ms":60000}',
      ),
    );

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const waitEvents = dataset.events.filter(
      (e) => e.toolName === "wait_agent",
    );
    expect(waitEvents.length).toBeGreaterThanOrEqual(1);
    expect(waitEvents[0].title).toBe("Wait (Alpha)");
    expect(waitEvents[0].waitReason).toBe("awaiting agents");
    expect(waitEvents[0].eventType).toBe("tool.started");
  });

  it("handles agent_reasoning entries as note events", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-18T10:00:00.000Z", "user", "분석해줘"),
        {
          timestamp: "2026-03-18T10:01:00.000Z",
          entryType: "agent_reasoning",
          role: null,
          text: "이 코드를 분석하면...",
          functionName: null,
          functionCallId: null,
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const reasoningEvents = dataset.events.filter(
      (e) => e.title === "Agent reasoning",
    );
    expect(reasoningEvents).toHaveLength(1);
    expect(reasoningEvents[0].eventType).toBe("note");
    expect(reasoningEvents[0].outputPreview).toContain("이 코드를 분석하면");
  });

  it("filters permissions instructions as system boilerplate", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-18T10:00:00.000Z", "user", "작업 시작"),
        makeMessageEntry(
          "2026-03-18T10:01:00.000Z",
          "user",
          "<permissions instructions>sandbox policy here</permissions instructions>",
        ),
        makeMessageEntry(
          "2026-03-18T10:02:00.000Z",
          "assistant",
          "알겠습니다.",
        ),
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const userPrompts = dataset.events.filter(
      (e) => e.eventType === "user.prompt",
    );
    // Only 1 user prompt (permissions one filtered)
    expect(userPrompts).toHaveLength(1);
    expect(
      userPrompts.every(
        (e) => !e.inputPreview?.includes("<permissions"),
      ),
    ).toBe(true);
  });

  it("skips merge edges when spawn_agent output is not JSON", () => {
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-nojson",
        parentThreadId: "nojson-session",
        depth: 1,
        agentNickname: "NoJson",
        agentRole: "worker",
        model: "gpt-5",
        startedAt: "2026-03-18T12:02:00.000Z",
        updatedAt: "2026-03-18T12:10:00.000Z",
        entries: [
          makeMessageEntry("2026-03-18T12:02:05.000Z", "assistant", "완료."),
        ],
      },
    ];

    const snapshot: SessionLogSnapshot = {
      sessionId: "nojson-session",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "nojson-test",
      startedAt: "2026-03-18T12:00:00.000Z",
      updatedAt: "2026-03-18T12:30:00.000Z",
      model: "gpt-5",
      entries: [
        makeMessageEntry("2026-03-18T12:00:05.000Z", "user", "작업 시작"),
        makeFunctionCallEntry(
          "2026-03-18T12:01:00.000Z",
          "spawn_agent",
          "call_sp_nj",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-18T12:01:05.000Z",
          "call_sp_nj",
          "Agent spawned successfully",
        ),
        makeFunctionCallEntry(
          "2026-03-18T12:12:00.000Z",
          "close_agent",
          "call_cl_nj",
          '{"id":"some-unknown-id"}',
        ),
      ],
      subagents,
    };

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    // No merge edges since spawn output wasn't JSON
    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    expect(mergeEdges).toHaveLength(0);

    // Spawn edges should still exist
    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    expect(spawnEdges).toHaveLength(1);
  });

  it("merge edge targets the function_call_output to prevent backward-flowing arrows", () => {
    // Scenario: parent calls wait_agent BEFORE subagent finishes.
    // Without the fix, the merge edge would go backward (target timestamp < source timestamp).
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-forward",
        parentThreadId: "forward-session",
        depth: 1,
        agentNickname: "ForwardAgent",
        agentRole: "worker",
        model: "claude-sonnet-4-6",
        startedAt: "2026-03-19T10:02:00.000Z",
        updatedAt: "2026-03-19T10:12:00.000Z",
        entries: [
          makeMessageEntry("2026-03-19T10:02:05.000Z", "assistant", "작업 시작"),
          makeMessageEntry("2026-03-19T10:10:00.000Z", "assistant", "작업 완료."),
        ],
      },
    ];

    const snapshot: SessionLogSnapshot = {
      sessionId: "forward-session",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "forward-test",
      startedAt: "2026-03-19T10:00:00.000Z",
      updatedAt: "2026-03-19T10:30:00.000Z",
      model: "claude-opus-4-6",
      entries: [
        makeMessageEntry("2026-03-19T10:00:05.000Z", "user", "작업 시작"),
        makeFunctionCallEntry(
          "2026-03-19T10:01:00.000Z",
          "spawn_agent",
          "call_sp_fwd",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-19T10:01:05.000Z",
          "call_sp_fwd",
          '{"agent_id":"cid-forward","nickname":"ForwardAgent"}',
        ),
        // Parent calls wait_agent at 10:05 — BEFORE the subagent finishes at 10:10
        makeFunctionCallEntry(
          "2026-03-19T10:05:00.000Z",
          "wait_agent",
          "call_wait_fwd",
          '{"ids":["cid-forward"],"timeout_ms":120000}',
        ),
        // wait_agent output arrives at 10:13 — AFTER the subagent finishes
        makeFunctionCallOutputEntry(
          "2026-03-19T10:13:00.000Z",
          "call_wait_fwd",
          '{"status":{"cid-forward":"completed"}}',
        ),
      ],
      subagents,
    };

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    expect(mergeEdges).toHaveLength(1);

    const sourceEvent = dataset.events.find((ev) => ev.eventId === mergeEdges[0].sourceEventId);
    const targetEvent = dataset.events.find((ev) => ev.eventId === mergeEdges[0].targetEventId);
    expect(sourceEvent).toBeDefined();
    expect(targetEvent).toBeDefined();

    // The merge target should be the function_call_output (tool.finished), not the function_call
    expect(targetEvent!.eventType).toBe("tool.finished");
    expect(targetEvent!.toolName).toBe("wait_agent");

    // The target event's timestamp must be >= source event's timestamp
    // to ensure the edge flows forward (downward) in the timeline
    expect(targetEvent!.startTs).toBeGreaterThanOrEqual(sourceEvent!.startTs);
  });

  it("spawn edge source is at or before the subagent start when using fallback", () => {
    // Scenario: no call_id match, fallback picks a parent event before the subagent start
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-fb",
        parentThreadId: "fb-session",
        depth: 1,
        agentNickname: "FallbackAgent",
        agentRole: "worker",
        model: "claude-sonnet-4-6",
        startedAt: "2026-03-19T10:03:00.000Z",
        updatedAt: "2026-03-19T10:10:00.000Z",
        entries: [
          makeMessageEntry("2026-03-19T10:03:05.000Z", "assistant", "완료."),
        ],
      },
    ];

    const snapshot: SessionLogSnapshot = {
      sessionId: "fb-session",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "fallback-test",
      startedAt: "2026-03-19T10:00:00.000Z",
      updatedAt: "2026-03-19T10:15:00.000Z",
      model: "claude-opus-4-6",
      entries: [
        makeMessageEntry("2026-03-19T10:00:05.000Z", "user", "작업 시작"),
        makeMessageEntry("2026-03-19T10:02:00.000Z", "assistant", "이전 작업"),
        // No spawn_agent function_call — subagent matched via chronological fallback
        makeMessageEntry("2026-03-19T10:05:00.000Z", "assistant", "이후 작업"),
      ],
      subagents,
    };

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const spawnEdges = dataset.edges.filter((e) => e.edgeType === "spawn");
    expect(spawnEdges).toHaveLength(1);

    const sourceEvent = dataset.events.find((ev) => ev.eventId === spawnEdges[0].sourceEventId);
    const targetEvent = dataset.events.find((ev) => ev.eventId === spawnEdges[0].targetEventId);
    expect(sourceEvent).toBeDefined();
    expect(targetEvent).toBeDefined();

    // The spawn source event should be at or before the subagent's spawned event
    expect(sourceEvent!.startTs).toBeLessThanOrEqual(targetEvent!.startTs);
  });

  it("merge edge uses spawned event when fork-context leak creates late subagent entries", () => {
    // Scenario: Rust backend includes parent's task_complete in subagent entries
    // (fork context leak). The task_complete has a VERY LATE timestamp (10:20:00)
    // while the wait_agent output is at 10:05:00. Without the fix, the merge edge
    // would go backward from 10:20:00 → 10:05:00.
    const subagents: SubagentSnapshot[] = [
      {
        sessionId: "sub-leak",
        parentThreadId: "leak-session",
        depth: 1,
        agentNickname: "LeakAgent",
        agentRole: "worker",
        model: "gpt-5.4",
        startedAt: "2026-03-19T10:02:00.000Z",
        updatedAt: "2026-03-19T10:20:00.000Z",
        entries: [
          makeMessageEntry("2026-03-19T10:02:05.000Z", "assistant", "작업 시작"),
          // Fork context leak: parent's task_complete appears in subagent entries
          // with a very late timestamp
          {
            timestamp: "2026-03-19T10:20:00.000Z",
            entryType: "task_complete",
            role: null,
            text: null,
            functionName: null,
            functionCallId: null,
            functionArgumentsPreview: null,
          },
        ],
      },
    ];

    const snapshot: SessionLogSnapshot = {
      sessionId: "leak-session",
      workspacePath: "/projects/test",
      originPath: "/projects/test",
      displayName: "fork-leak-test",
      startedAt: "2026-03-19T10:00:00.000Z",
      updatedAt: "2026-03-19T10:25:00.000Z",
      model: "gpt-5.3",
      entries: [
        makeMessageEntry("2026-03-19T10:00:05.000Z", "user", "작업 시작"),
        makeFunctionCallEntry(
          "2026-03-19T10:01:00.000Z",
          "spawn_agent",
          "call_sp_lk",
          '{"agent_type":"worker"}',
        ),
        makeFunctionCallOutputEntry(
          "2026-03-19T10:01:05.000Z",
          "call_sp_lk",
          '{"agent_id":"sub-leak","nickname":"LeakAgent"}',
        ),
        makeFunctionCallEntry(
          "2026-03-19T10:03:00.000Z",
          "wait_agent",
          "call_wait_lk",
          '{"ids":["sub-leak"],"timeout_ms":120000}',
        ),
        // wait_agent output at 10:05:00 — BEFORE the leaked task_complete at 10:20:00
        makeFunctionCallOutputEntry(
          "2026-03-19T10:05:00.000Z",
          "call_wait_lk",
          '{"status":{"sub-leak":{"completed":"done"}}}',
        ),
      ],
      subagents,
    };

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const mergeEdges = dataset.edges.filter((e) => e.edgeType === "merge");
    expect(mergeEdges).toHaveLength(1);

    const sourceEvent = dataset.events.find((ev) => ev.eventId === mergeEdges[0].sourceEventId);
    const targetEvent = dataset.events.find((ev) => ev.eventId === mergeEdges[0].targetEventId);
    expect(sourceEvent).toBeDefined();
    expect(targetEvent).toBeDefined();

    // The merge edge must NOT flow backward:
    // source timestamp should be <= target timestamp
    expect(sourceEvent!.startTs).toBeLessThanOrEqual(targetEvent!.startTs);

    // The source should be the spawned event (fallback), not the leaked task_complete
    expect(sourceEvent!.eventType).not.toBe("turn.finished");
  });
});

describe("token_count enrichment", () => {
  it("attaches token data from token_count entries to the preceding event", () => {
    const entries: SessionEntrySnapshot[] = [
      makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Hello"),
      makeMessageEntry("2026-03-19T10:00:05.000Z", "assistant", "Hi there"),
      {
        timestamp: "2026-03-19T10:00:06.000Z",
        entryType: "token_count",
        role: null,
        text: '{"in":20090,"cached":3712,"out":1047}',
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
    ];

    const snapshot = buildSnapshot(entries);
    snapshot.model = "claude-sonnet-4-6";
    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    // token_count should NOT produce its own visible event
    const tokenEvents = dataset.events.filter((e) => e.title === "token_count");
    expect(tokenEvents).toHaveLength(0);

    // The assistant "note" event should have token data attached
    const assistantNote = dataset.events.find(
      (e) => e.eventType === "note" && e.title === "Assistant",
    );
    expect(assistantNote).toBeDefined();
    expect(assistantNote!.tokensIn).toBe(20090);
    expect(assistantNote!.tokensOut).toBe(1047);
    expect(assistantNote!.cacheReadTokens).toBe(3712);

    // Summary metrics should reflect the token data
    expect(dataset.run.summaryMetrics.tokens).toBe(20090 + 1047);
  });

  it("does not create visible events for token_count entries", () => {
    const entries: SessionEntrySnapshot[] = [
      makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Test"),
      {
        timestamp: "2026-03-19T10:00:01.000Z",
        entryType: "token_count",
        role: null,
        text: '{"in":100,"cached":0,"out":50}',
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
    ];

    const snapshot = buildSnapshot(entries);
    snapshot.model = "claude-sonnet-4-6";
    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    // Only lifecycle events + user prompt, no token_count event
    const nonLifecycleEvents = dataset.events.filter(
      (e) => !e.eventType.startsWith("run.") && e.eventType !== "run.started",
    );
    expect(nonLifecycleEvents.every((e) => e.title !== "token_count")).toBe(true);
  });
});

describe("tool input preview extraction", () => {
  it("extracts cmd from exec_command JSON arguments", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Check status"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_exec",
          functionArgumentsPreview: '{"cmd":"git status --short","workdir":"/tmp/test"}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "exec_command");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("git status --short");
  });

  it("extracts message from spawn_agent JSON arguments", () => {
    const snapshot = buildSnapshot([
      makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Review code"),
      {
        timestamp: "2026-03-19T10:00:05.000Z",
        entryType: "function_call",
        role: null,
        text: null,
        functionName: "spawn_agent",
        functionCallId: "call_spawn_msg",
        functionArgumentsPreview: '{"agent_type":"code-quality-reviewer","message":"코드 품질 리뷰해주세요"}',
      },
    ]);

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const spawnEvent = dataset.events.find((e) => e.toolName === "spawn_agent");
    expect(spawnEvent).toBeDefined();
    expect(spawnEvent!.inputPreview).toBe("코드 품질 리뷰해주세요");
  });

  it("extracts explanation from update_plan JSON arguments", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Start plan"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "update_plan",
          functionCallId: "call_plan",
          functionArgumentsPreview: '{"explanation":"Runtime 추출 작업 진행 중","plan":[{"step":"scaffold","status":"completed"}]}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const planEvent = dataset.events.find((e) => e.toolName === "update_plan");
    expect(planEvent).toBeDefined();
    expect(planEvent!.outputPreview).toBe("Runtime 추출 작업 진행 중");
  });

  it("extracts path from apply_patch JSON arguments", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Fix the file"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "apply_patch",
          functionCallId: "call_patch",
          functionArgumentsPreview: '{"path":"src/app/main.ts","patch":"..."}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "apply_patch");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("src/app/main.ts");
  });

  it("falls back to raw preview when JSON parsing fails", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Run it"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_raw",
          functionArgumentsPreview: "not-json",
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "exec_command");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("not-json");
  });

  it("extracts message from send_input JSON arguments with interrupt prefix", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Check agent"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "send_input",
          functionCallId: "call_send",
          functionArgumentsPreview: '{"id":"agent-1","message":"Stop and report status","interrupt":true}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "send_input");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("[interrupt] Stop and report status");
  });

  it("extracts path from view_image JSON arguments", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Show me the image"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "view_image",
          functionCallId: "call_img",
          functionArgumentsPreview: '{"path":"/tmp/screenshot.png"}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "view_image");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("/tmp/screenshot.png");
  });

  it("extracts input from write_stdin JSON arguments", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Confirm"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "write_stdin",
          functionCallId: "call_stdin",
          functionArgumentsPreview: '{"input":"y\\n"}',
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "write_stdin");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("y\n");
  });

  it("extracts file path from apply_patch raw patch text", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Patch it"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "apply_patch",
          functionCallId: "call_raw_patch",
          functionArgumentsPreview: "*** Begin Patch\n*** Update File: src/utils/helper.ts\n+export function greet() {}",
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const toolEvent = dataset.events.find((e) => e.toolName === "apply_patch");
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.inputPreview).toBe("src/utils/helper.ts");
  });

  it("extracts inner output from Codex-style JSON tool output", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Fix it"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "apply_patch",
          functionCallId: "call_patch",
          functionArgumentsPreview: "*** Begin Patch\n*** Update File: src/app.ts",
        },
        {
          timestamp: "2026-03-19T10:00:06.000Z",
          entryType: "function_call_output",
          role: null,
          text: '{"output":"Success. Updated the following files:\\nM src/app.ts\\n","metadata":{"exit_code":0,"duration_seconds":0.1}}',
          functionName: null,
          functionCallId: "call_patch",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const resultEvent = dataset.events.find((e) => e.eventType === "tool.finished" && e.toolName === "apply_patch");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.outputPreview).toBe("Success. Updated the following files: M src/app.ts");
  });

  it("wait output shows 'Timed out' for timed_out responses", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Go"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "wait",
          functionCallId: "call_wait",
          functionArgumentsPreview: '{"ids":["agent-1"]}',
        },
        {
          timestamp: "2026-03-19T10:00:06.000Z",
          entryType: "function_call_output",
          role: null,
          text: '{"status":{},"timed_out":true}',
          functionName: null,
          functionCallId: "call_wait",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const resultEvent = dataset.events.find((e) => e.eventType === "tool.finished" && e.toolName === "wait");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.outputPreview).toBe("Timed out (polling)");
  });

  it("spawn_agent output shows agent nickname", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Go"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "spawn_agent",
          functionCallId: "call_spawn_out",
          functionArgumentsPreview: '{"message":"do stuff"}',
        },
        {
          timestamp: "2026-03-19T10:00:06.000Z",
          entryType: "function_call_output",
          role: null,
          text: '{"agent_id":"agent-123","nickname":"Pasteur"}',
          functionName: null,
          functionCallId: "call_spawn_out",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const resultEvent = dataset.events.find((e) => e.eventType === "tool.finished" && e.toolName === "spawn_agent");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.outputPreview).toBe("Spawned: Pasteur");
  });

  it("send_input output shows 'Input delivered'", () => {
    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Go"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "send_input",
          functionCallId: "call_send_out",
          functionArgumentsPreview: '{"id":"agent-1","message":"stop"}',
        },
        {
          timestamp: "2026-03-19T10:00:06.000Z",
          entryType: "function_call_output",
          role: null,
          text: '{"submission_id":"sub-123"}',
          functionName: null,
          functionCallId: "call_send_out",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const resultEvent = dataset.events.find((e) => e.eventType === "tool.finished" && e.toolName === "send_input");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.outputPreview).toBe("Input delivered");
  });

  it("strips exec_command output boilerplate and shows actual content", () => {
    const boilerplateOutput = [
      "Command: /bin/zsh -lc 'git status'",
      "Chunk ID: abc123",
      "Wall time: 0.0100 seconds",
      "Process exited with code 0",
      "Original token count: 42",
      "Output:",
      "## branch main",
      "M src/app.ts",
    ].join("\n");

    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Check status"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_exec_out",
          functionArgumentsPreview: '{"cmd":"git status"}',
        },
        {
          timestamp: "2026-03-19T10:00:06.000Z",
          entryType: "function_call_output",
          role: null,
          text: boilerplateOutput,
          functionName: null,
          functionCallId: "call_exec_out",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const resultEvent = dataset.events.find((e) => e.eventType === "tool.finished" && e.toolName === "exec_command");
    expect(resultEvent).toBeDefined();
    // Should show the content after "Output:" not the boilerplate
    expect(resultEvent!.outputPreview).toContain("branch main");
    expect(resultEvent!.outputPreview).not.toContain("Chunk ID");
    // Successful command should not have errorMessage
    expect(resultEvent!.errorMessage).toBeNull();
  });

  it("marks failed exec_command output with 'failed' status and exit code", () => {
    const failedOutput = [
      "Command: /bin/zsh -lc 'pnpm build'",
      "Chunk ID: abc123",
      "Wall time: 5.0 seconds",
      "Process exited with code 2",
      "Original token count: 200",
      "Output:",
      "error TS2322: Type 'string' is not assignable to type 'number'.",
    ].join("\n");

    const dataset = buildDatasetFromSessionLog(
      buildSnapshot([
        makeMessageEntry("2026-03-19T10:00:00.000Z", "user", "Build it"),
        {
          timestamp: "2026-03-19T10:00:05.000Z",
          entryType: "function_call",
          role: null,
          text: null,
          functionName: "exec_command",
          functionCallId: "call_fail",
          functionArgumentsPreview: '{"cmd":"pnpm build"}',
        },
        {
          timestamp: "2026-03-19T10:00:10.000Z",
          entryType: "function_call_output",
          role: null,
          text: failedOutput,
          functionName: null,
          functionCallId: "call_fail",
          functionArgumentsPreview: null,
        },
      ]),
    );

    expect(dataset).not.toBeNull();
    if (!dataset) return;

    const resultEvent = dataset.events.find((e) => e.eventType === "tool.finished" && e.toolName === "exec_command");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.status).toBe("failed");
    expect(resultEvent!.errorMessage).toBe("Exit code 2");
  });
});
