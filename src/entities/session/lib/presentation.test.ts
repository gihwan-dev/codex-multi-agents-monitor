import { describe, expect, it } from "vitest";

import {
  formatSessionDisplayTitle,
  formatTimestamp,
  normalizeSessionTitle,
} from "./presentation";

describe("session title presentation helpers", () => {
  it("normalizes noisy prompt-style titles into a readable display title", () => {
    const rawTitle = `# AGENTS.md instructions for /Users/choegihwan/.codex/worktrees/demo/repo
<INSTRUCTIONS>
## Global Agent Policy This file defines global defaults for Codex across all repositories.

1. 제목이 이상하게 캡쳐됨. 2번째 이미지처럼 Codex Desktop 앱 느낌으로 맞춰줘.`;

    expect(normalizeSessionTitle(rawTitle)).toBe("제목이 이상하게 캡쳐됨.");
  });

  it("prefers the first substantive user question after scaffold blocks", () => {
    const rawTitle = `# AGENTS.md instructions for /tmp/workspace
<INSTRUCTIONS>
Global Agent Policy
This file defines global defaults for Codex across all repositories.
</INSTRUCTIONS>
<environment_context>
  <cwd>/tmp/workspace</cwd>
</environment_context>
[$design-task] 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?`;

    expect(normalizeSessionTitle(rawTitle)).toBe(
      "$design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
  });

  it("combines multiline skill-link prefixes with the first substantive line", () => {
    const rawTitle = `# AGENTS.md instructions for /tmp/workspace
<INSTRUCTIONS>
Global Agent Policy
</INSTRUCTIONS>
[$design-task](/Users/choegihwan/Documents/Projects/claude-setup/skills/design-task/SKILL.md)
지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?`;

    expect(normalizeSessionTitle(rawTitle)).toBe(
      "$design-task 지금 내가 Table 컴포넌트의 리액트 의존성을 덜어내는 작업을 하고 있거든?",
    );
  });

  it("leaves concise titles unchanged", () => {
    expect(normalizeSessionTitle("Liquid Glass shell redesign")).toBe(
      "Liquid Glass shell redesign",
    );
  });

  it("falls back to the workspace label when the raw title is missing", () => {
    expect(
      formatSessionDisplayTitle({
        rawTitle: null,
        workspacePath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
      }),
    ).toMatchObject({
      displayTitle: "codex-multi-agent-monitor session",
      tooltip: "codex-multi-agent-monitor session",
      workspaceLabel: "codex-multi-agent-monitor",
    });
  });

  it("preserves the raw title for tooltips while showing the cleaned label", () => {
    const result = formatSessionDisplayTitle({
      rawTitle:
        "# AGENTS.md instructions for /Users/choegihwan/.codex/worktrees/demo/repo\n1. 제목이 이상하게 캡쳐됨.",
      workspacePath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
    });

    expect(result.displayTitle).toBe("제목이 이상하게 캡쳐됨.");
    expect(result.tooltip).toContain("AGENTS.md instructions for");
  });

  it("formats refresh markers using only the timestamp portion", () => {
    expect(
      formatTimestamp("2026-03-12T07:00:00.000Z#00000000000000000005"),
    ).toContain("26. 3. 12.");
  });
});
