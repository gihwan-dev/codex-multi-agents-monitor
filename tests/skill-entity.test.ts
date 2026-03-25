import { describe, expect, it } from "vitest";
import type { PromptLayer, RunDataset } from "../src/entities/run/index.js";
import { parseCatalogSkills } from "../src/entities/skill/lib/catalogParser.js";
import { scanSkillInvocations } from "../src/entities/skill/lib/invocationScanner.js";
import { buildSkillActivityItems } from "../src/entities/skill/lib/activityAggregator.js";
import { sortSkills, filterSkillsByStatus, filterSkillsBySearch } from "../src/entities/skill/lib/skillSorting.js";
import type { SkillActivityItem } from "../src/entities/skill/model/types.js";

function makeCatalogLayer(overrides: Partial<PromptLayer> = {}): PromptLayer {
  return {
    layerId: "test:layer:0",
    layerType: "skills-catalog",
    label: "Skills Catalog",
    preview: "",
    contentLength: 0,
    rawContent: null,
    ...overrides,
  };
}

function makeMinimalDataset(overrides: Partial<RunDataset> = {}): RunDataset {
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
    ...overrides,
  };
}

describe("catalogParser", () => {
  it("extracts skills from real codex format (bullet with file path)", () => {
    const layer = makeCatalogLayer({
      rawContent: [
        "<skills_instructions>",
        "## Skills",
        "### Available skills",
        "- commit: Generate conventional commit messages (file: /path/to/commit/SKILL.md)",
        "- test: Run test suites with Vitest (file: /path/to/test/SKILL.md)",
        "</skills_instructions>",
      ].join("\n"),
    });

    const result = parseCatalogSkills(layer);
    expect(result).toHaveLength(2);
    expect(result[0].skillName).toBe("commit");
    expect(result[0].description).toBe("Generate conventional commit messages");
    expect(result[1].skillName).toBe("test");
  });

  it("extracts skills from simple bullet list", () => {
    const layer = makeCatalogLayer({
      preview: "- commit: Generate commit messages\n- test: Run test suites",
    });

    const result = parseCatalogSkills(layer);
    expect(result).toHaveLength(2);
    expect(result[0].skillName).toBe("commit");
    expect(result[0].description).toBe("Generate commit messages");
  });

  it("extracts skills from markdown links as fallback", () => {
    const layer = makeCatalogLayer({
      preview: "[$commit](/path/to/SKILL.md)\n[$test](/path/to/SKILL.md)",
    });

    const result = parseCatalogSkills(layer);
    expect(result).toHaveLength(2);
    expect(result[0].skillName).toBe("commit");
  });

  it("deduplicates skill names", () => {
    const layer = makeCatalogLayer({
      rawContent: "- commit: desc A (file: /a/SKILL.md)\n- commit: desc B (file: /b/SKILL.md)",
    });

    const result = parseCatalogSkills(layer);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty layer", () => {
    const layer = makeCatalogLayer({ preview: "", rawContent: null });
    expect(parseCatalogSkills(layer)).toHaveLength(0);
  });

  it("prefers rawContent over preview when available", () => {
    const layer = makeCatalogLayer({
      preview: "<skills_instructions>\n## Skills",
      rawContent: "- commit: Commit tool (file: /a/SKILL.md)\n- test: Test runner (file: /b/SKILL.md)",
    });

    const result = parseCatalogSkills(layer);
    expect(result).toHaveLength(2);
  });
});

describe("invocationScanner", () => {
  it("scans skill layers from prompt assembly (real Codex label format)", () => {
    const dataset = makeMinimalDataset({
      promptAssembly: {
        layers: [
          { layerId: "l1", layerType: "skill", label: "Skill: commit", preview: "...", contentLength: 100, rawContent: null },
          { layerId: "l2", layerType: "skill", label: "Skill: test", preview: "...", contentLength: 100, rawContent: null },
          { layerId: "l3", layerType: "system", label: "Base", preview: "...", contentLength: 100, rawContent: null },
        ],
        totalContentLength: 300,
      },
    });

    const result = scanSkillInvocations(dataset);
    expect(result).toHaveLength(2);
    expect(result[0].skillName).toBe("commit");
    expect(result[1].skillName).toBe("test");
  });

  it("scans tool events matching known skill names", () => {
    const dataset = makeMinimalDataset({
      events: [
        {
          eventId: "e1", parentId: null, linkIds: [], laneId: "lane-1", agentId: "agent-1",
          threadId: "t1", eventType: "tool.started", status: "done", waitReason: null,
          retryCount: 0, startTs: 1100, endTs: 1200, durationMs: 100,
          title: "commit", inputPreview: null, outputPreview: null,
          artifactId: null, errorCode: null, errorMessage: null,
          provider: null, model: null, toolName: "commit",
          tokensIn: 0, tokensOut: 0, reasoningTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, finishReason: null,
          rawInput: null, rawOutput: null,
        },
      ],
    });

    const result = scanSkillInvocations(dataset, new Set(["commit"]));
    expect(result).toHaveLength(1);
    expect(result[0].skillName).toBe("commit");
    expect(result[0].agentName).toBe("main");
  });

  it("returns empty for dataset without prompt assembly", () => {
    const dataset = makeMinimalDataset();
    expect(scanSkillInvocations(dataset)).toHaveLength(0);
  });
});

describe("activityAggregator", () => {
  it("builds items with correct status classification", () => {
    const activeDataset = makeMinimalDataset({
      run: {
        ...makeMinimalDataset().run,
        traceId: "active-run",
      },
      promptAssembly: {
        layers: [
          {
            layerId: "cat-1", layerType: "skills-catalog", label: "Skills Catalog",
            preview: "<skills_instructions>...",
            contentLength: 200,
            rawContent: "- commit: Commit tool (file: /a/SKILL.md)\n- test: Test tool (file: /b/SKILL.md)\n- review: Review tool (file: /c/SKILL.md)",
          },
          { layerId: "sk-1", layerType: "skill", label: "Skill: commit", preview: "...", contentLength: 50, rawContent: null },
        ],
        totalContentLength: 250,
      },
    });

    const olderDataset = makeMinimalDataset({
      run: {
        ...makeMinimalDataset().run,
        traceId: "older-run",
      },
      promptAssembly: {
        layers: [
          { layerId: "sk-2", layerType: "skill", label: "Skill: test", preview: "...", contentLength: 50, rawContent: null },
        ],
        totalContentLength: 50,
      },
    });

    const items = buildSkillActivityItems([activeDataset, olderDataset], "active-run");

    const commitItem = items.find((i) => i.skillName === "commit");
    expect(commitItem?.status).toBe("active-run");

    const testItem = items.find((i) => i.skillName === "test");
    expect(testItem?.status).toBe("recently-used");

    const reviewItem = items.find((i) => i.skillName === "review");
    expect(reviewItem?.status).toBe("never-seen");
  });

  it("marks unlisted skills correctly", () => {
    const dataset = makeMinimalDataset({
      promptAssembly: {
        layers: [
          { layerId: "sk-1", layerType: "skill", label: "Skill: unknown-skill", preview: "...", contentLength: 50, rawContent: null },
        ],
        totalContentLength: 50,
      },
    });

    const items = buildSkillActivityItems([dataset], "run-1");
    const unlisted = items.find((i) => i.skillName === "unknown-skill");
    expect(unlisted?.status).toBe("unlisted");
    expect(unlisted?.catalogSource).toBeNull();
  });

  it("returns empty array for datasets without catalog or skills", () => {
    const dataset = makeMinimalDataset();
    expect(buildSkillActivityItems([dataset], "run-1")).toHaveLength(0);
  });
});

describe("skillSorting", () => {
  const items: SkillActivityItem[] = [
    { skillName: "beta", status: "never-seen", description: "", invocationCount: 0, currentRunInvocations: 0, lastInvocationTs: null, lastInvocationAgent: null, recentInvocations: [], catalogSource: "c1" },
    { skillName: "alpha", status: "active-run", description: "alpha desc", invocationCount: 5, currentRunInvocations: 3, lastInvocationTs: 2000, lastInvocationAgent: "main", recentInvocations: [], catalogSource: "c1" },
    { skillName: "gamma", status: "recently-used", description: "gamma search", invocationCount: 2, currentRunInvocations: 0, lastInvocationTs: 1000, lastInvocationAgent: "sub", recentInvocations: [], catalogSource: "c1" },
  ];

  it("sorts by name ascending", () => {
    const sorted = sortSkills(items, "name", "asc");
    expect(sorted.map((i) => i.skillName)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("sorts by status (active-run first)", () => {
    const sorted = sortSkills(items, "status", "asc");
    expect(sorted[0].status).toBe("active-run");
    expect(sorted[2].status).toBe("never-seen");
  });

  it("sorts by invocation count descending", () => {
    const sorted = sortSkills(items, "invocationCount", "desc");
    expect(sorted[0].invocationCount).toBe(5);
    expect(sorted[2].invocationCount).toBe(0);
  });

  it("sorts by last invocation descending", () => {
    const sorted = sortSkills(items, "lastInvocation", "desc");
    expect(sorted[0].skillName).toBe("alpha");
    expect(sorted[1].skillName).toBe("gamma");
  });

  it("filters by status", () => {
    const filtered = filterSkillsByStatus(items, "active-run");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].skillName).toBe("alpha");
  });

  it("filters by search query on name", () => {
    const filtered = filterSkillsBySearch(items, "alph");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].skillName).toBe("alpha");
  });

  it("filters by search query on description", () => {
    const filtered = filterSkillsBySearch(items, "search");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].skillName).toBe("gamma");
  });

  it("returns all items for 'all' status filter", () => {
    const filtered = filterSkillsByStatus(items, "all");
    expect(filtered).toHaveLength(3);
  });

  it("returns all items for empty search query", () => {
    const filtered = filterSkillsBySearch(items, "  ");
    expect(filtered).toHaveLength(3);
  });
});
