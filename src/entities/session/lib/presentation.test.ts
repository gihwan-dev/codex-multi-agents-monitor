import { describe, expect, it } from "vitest";

import {
  formatSessionDisplayTitle,
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
});
