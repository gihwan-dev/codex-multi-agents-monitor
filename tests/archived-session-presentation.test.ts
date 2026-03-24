import { describe, expect, it } from "vitest";
import {
  deriveArchivedSessionTitle,
  formatArchivedSessionDate,
} from "../src/widgets/workspace-run-tree/lib/archivedSessionPresentation.js";

describe("archivedSessionPresentation", () => {
  it("formats archived timestamps into a stable local string", () => {
    expect(formatArchivedSessionDate("2026-03-20T05:06:00")).toBe("2026-03-20 05:06");
  });

  it("falls back to the formatted timestamp when there is no first user message", () => {
    expect(
      deriveArchivedSessionTitle({
        sessionId: "session-1",
        workspacePath: "/tmp/workspace-a",
        originPath: "/tmp/workspace-a",
        displayName: "Workspace A",
        startedAt: "2026-03-20T05:06:00",
        updatedAt: "2026-03-20T05:06:00",
        model: null,
        messageCount: 1,
        filePath: "/tmp/workspace-a/session-1.json",
        firstUserMessage: null,
      }),
    ).toBe("2026-03-20 05:06");
  });
});
