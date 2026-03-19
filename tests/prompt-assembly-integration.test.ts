import { describe, expect, it } from "vitest";
import { buildDatasetFromSessionLog } from "../src/app/sessionLogLoader";
import type { SessionLogSnapshot } from "../src/app/sessionLogLoader";

function makeSnapshot(overrides: Partial<SessionLogSnapshot> = {}): SessionLogSnapshot {
  return {
    sessionId: "test-session",
    workspacePath: "/tmp/test",
    originPath: "/tmp/test",
    displayName: "test",
    startedAt: "2026-03-18T09:00:00.000Z",
    updatedAt: "2026-03-18T09:10:00.000Z",
    model: "gpt-5",
    entries: [
      {
        timestamp: "2026-03-18T09:01:00.000Z",
        entryType: "message",
        role: "user",
        text: "Hello world",
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
      {
        timestamp: "2026-03-18T09:02:00.000Z",
        entryType: "message",
        role: "assistant",
        text: "Hi there!",
        functionName: null,
        functionCallId: null,
        functionArgumentsPreview: null,
      },
    ],
    ...overrides,
  };
}

describe("promptAssembly mapping", () => {
  it("maps promptAssembly layers from snapshot to dataset", () => {
    const snapshot = makeSnapshot({
      promptAssembly: [
        {
          layerType: "system",
          label: "Base Instructions",
          contentLength: 15000,
          preview: "You are a helpful assistant...",
          rawContent: "You are a helpful assistant with many capabilities.",
        },
        {
          layerType: "permissions",
          label: "Permissions & Sandbox",
          contentLength: 362,
          preview: "<permissions instructions>...",
          rawContent: "<permissions instructions>sandbox policy</permissions>",
        },
        {
          layerType: "agents",
          label: "AGENTS.md",
          contentLength: 5200,
          preview: "# AGENTS.md instructions...",
          rawContent: "# AGENTS.md instructions\nProject guidance content.",
        },
        {
          layerType: "user",
          label: "User Prompt",
          contentLength: 100,
          preview: "Hello world",
          rawContent: "Hello world",
        },
      ],
    });

    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    expect(dataset!.promptAssembly).toBeDefined();

    const assembly = dataset!.promptAssembly!;
    expect(assembly.layers).toHaveLength(4);
    expect(assembly.totalContentLength).toBe(15000 + 362 + 5200 + 100);

    expect(assembly.layers[0].layerType).toBe("system");
    expect(assembly.layers[0].label).toBe("Base Instructions");
    expect(assembly.layers[0].layerId).toBe("test-session:layer:0");
    expect(assembly.layers[0].contentLength).toBe(15000);

    expect(assembly.layers[2].layerType).toBe("agents");
    expect(assembly.layers[2].label).toBe("AGENTS.md");

    expect(assembly.layers[3].layerType).toBe("user");
    expect(assembly.layers[3].rawContent).toBe("Hello world");
  });

  it("returns undefined promptAssembly when no layers present", () => {
    const snapshot = makeSnapshot({ promptAssembly: [] });
    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    expect(dataset!.promptAssembly).toBeUndefined();
  });

  it("returns undefined promptAssembly when field is absent", () => {
    const snapshot = makeSnapshot();
    const dataset = buildDatasetFromSessionLog(snapshot);
    expect(dataset).not.toBeNull();
    expect(dataset!.promptAssembly).toBeUndefined();
  });
});
