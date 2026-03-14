import { describe, expect, it } from "vitest";
import {
  buildDatasetFromSessionLog,
  deriveSessionLogStatus,
  deriveSessionLogTitle,
  NEW_THREAD_TITLE,
  type SessionLogSnapshot,
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
