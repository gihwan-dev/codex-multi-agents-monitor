// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadArchivedSessionIndex,
  loadSessionLogDatasets,
} from "../src/entities/session-log/index.js";
import { MonitorPage } from "../src/pages/monitor/index.js";

vi.mock("../src/entities/session-log/index.js", () => ({
  loadArchivedSessionIndex: vi.fn(),
  loadSessionLogDatasets: vi.fn(),
}));

const mockedLoadArchivedSessionIndex = vi.mocked(loadArchivedSessionIndex);
const mockedLoadSessionLogDatasets = vi.mocked(loadSessionLogDatasets);

let container: HTMLDivElement;
let root: Root;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function buildArchivedSessionIndexItem() {
  return {
    sessionId: "session-archive-001",
    workspacePath: "/tmp/archive-workspace",
    originPath: "/tmp/archive-workspace",
    displayName: "Archived workspace",
    startedAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:05:00.000Z",
    model: "gpt-5",
    messageCount: 12,
    filePath: "/tmp/archive-workspace/session-archive-001.json",
    firstUserMessage: "Archive regression coverage",
  };
}

function dispatchKeydown(key: string) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  vi.clearAllMocks();
  delete (HTMLElement.prototype as { scrollTo?: () => void }).scrollTo;
  vi.unstubAllGlobals();
});

describe("MonitorPage integration", () => {
  it("kicks off mount loading and keeps keyboard, drawer, and focus behavior intact", async () => {
    const archivedIndexRequest = createDeferred<{
      items: Array<ReturnType<typeof buildArchivedSessionIndexItem>>;
      total: number;
      hasMore: boolean;
    }>();

    mockedLoadSessionLogDatasets.mockResolvedValue(null);
    mockedLoadArchivedSessionIndex.mockReturnValue(archivedIndexRequest.promise);

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    await vi.waitFor(() => {
      expect(mockedLoadSessionLogDatasets).toHaveBeenCalledTimes(1);
      expect(mockedLoadArchivedSessionIndex).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      archivedIndexRequest.resolve({
        items: [buildArchivedSessionIndexItem()],
        total: 1,
        hasMore: false,
      });
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Archive");
    });

    const archiveCount = container.querySelector<HTMLElement>('[data-slot="archive-count"]');
    expect(archiveCount?.textContent).toBe("1");

    const archiveSectionToggle = container.querySelector<HTMLButtonElement>(
      '[data-slot="archive-section-toggle"]',
    );
    expect(archiveSectionToggle).not.toBeNull();
    if (!archiveSectionToggle) {
      throw new Error("archive section toggle missing");
    }

    await act(async () => {
      archiveSectionToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("1 / 1");
    });

    expect(container.textContent).toContain("Archived workspace");

    const searchInput = container.querySelector<HTMLInputElement>('[aria-label="Search workspaces and runs"]');
    expect(searchInput).not.toBeNull();
    if (!searchInput) {
      throw new Error("monitor search input missing");
    }

    await act(async () => {
      dispatchKeydown("/");
    });

    expect(document.activeElement).toBe(searchInput);

    searchInput.blur();

    await act(async () => {
      dispatchKeydown("?");
    });

    expect(document.body.textContent).toContain("Shortcut help");

    await act(async () => {
      dispatchKeydown("?");
    });

    expect(document.body.textContent).not.toContain("Shortcut help");

    const helpButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Help",
    );
    expect(helpButton).not.toBeNull();
    if (!helpButton) {
      throw new Error("help button missing");
    }

    helpButton.focus();

    await act(async () => {
      helpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const closeHelpButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.textContent?.trim() === "Close",
    );
    const closeHelpButton = closeHelpButtons.at(-1) ?? null;
    expect(closeHelpButton).not.toBeNull();
    if (!closeHelpButton) {
      throw new Error("close help button missing");
    }

    await act(async () => {
      closeHelpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(document.body.textContent).not.toContain("Shortcut help");
    });

    const importButton =
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Import",
      ) ?? null;
    expect(importButton).not.toBeNull();
    if (!importButton) {
      throw new Error("import button missing");
    }

    importButton.focus();

    await act(async () => {
      importButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const closeDrawerButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close drawer"]',
    );
    expect(closeDrawerButton).not.toBeNull();
    if (!closeDrawerButton) {
      throw new Error("close drawer button missing");
    }

    await act(async () => {
      closeDrawerButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.activeElement).toBe(importButton);
  });
});
