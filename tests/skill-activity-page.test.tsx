// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunDataset } from "../src/entities/run/index.js";
import { SkillActivityPage } from "../src/pages/skill-activity/index.js";
import { ThemeProvider } from "../src/shared/theme/index.js";
import { loadSkillActivityScan } from "../src/entities/skill/index.js";

vi.mock("../src/entities/skill/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/entities/skill/index.js")>();

  return {
    ...actual,
    loadSkillActivityScan: vi.fn(),
  };
});

const mockedLoadSkillActivityScan = vi.mocked(loadSkillActivityScan);

let container: HTMLDivElement;
let root: Root;

function makeDataset(): RunDataset {
  return {
    project: { projectId: "p1", name: "test", repoPath: "/tmp", badge: "" },
    session: { sessionId: "s1", title: "Test", owner: "user", startedAt: 1000 },
    run: {
      traceId: "run-1",
      title: "Test run",
      status: "done",
      startTs: 1000,
      endTs: 2000,
      durationMs: 1000,
      environment: "Import",
      liveMode: "imported",
      summaryMetrics: {
        totalDurationMs: 1000,
        activeTimeMs: 800,
        idleTimeMs: 200,
        longestGapMs: 100,
        agentCount: 1,
        peakParallelism: 1,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: null,
      selectedByDefaultId: null,
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes: [{ laneId: "lane-1", agentId: "agent-1", threadId: "t1", name: "main", role: "assistant", model: "gpt-5", provider: "openai", badge: "", laneStatus: "done" }],
    events: [],
    edges: [],
    artifacts: [],
    promptAssembly: {
      layers: [
        {
          layerId: "cat-1",
          layerType: "skills-catalog",
          label: "Skills Catalog",
          preview: "<skills_instructions>...",
          contentLength: 200,
          rawContent: "- commit: Commit tool (file: /a/SKILL.md)",
        },
        {
          layerId: "sk-1",
          layerType: "skill",
          label: "Skill: commit",
          preview: "...",
          contentLength: 50,
          rawContent: null,
        },
      ],
      totalContentLength: 250,
    },
  };
}

function findButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.includes(text),
  ) ?? null;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockedLoadSkillActivityScan.mockResolvedValue([]);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  vi.clearAllMocks();
});

describe("SkillActivityPage", () => {
  it("renders skill rows as non-interactive content", async () => {
    await act(async () => {
      root.render(
        createElement(
          ThemeProvider,
          null,
          createElement(SkillActivityPage, {
            datasets: [makeDataset()],
            activeRunId: "run-1",
            onNavigateToMonitor: vi.fn(),
          }),
        ),
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("commit");
    });

    expect(findButtonByText(container, "commit")).toBeNull();

    const row = container.querySelector<HTMLElement>('[data-slot="skill-activity-row"]');
    expect(row).not.toBeNull();
    if (!row) {
      throw new Error("skill activity row missing");
    }

    await act(async () => {
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("commit");
  });
});
