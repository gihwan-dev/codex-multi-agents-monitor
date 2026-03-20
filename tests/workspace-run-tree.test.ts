// @vitest-environment jsdom

import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/index.js";
import { WorkspaceRunTree } from "../src/widgets/workspace-run-tree/ui/WorkspaceRunTree.js";

let container: HTMLDivElement;
let root: Root;

async function renderWorkspaceRunTree() {
  const state = createMonitorInitialState();

  await act(async () => {
    root.render(
      createElement(WorkspaceRunTree, {
        datasets: state.datasets,
        activeRunId: state.activeRunId,
        onSelectRun: () => {},
        onOpenImport: () => {},
        searchRef: createRef<HTMLInputElement>(),
        workspaceIdentityOverrides: {},
        archivedIndex: [],
        archivedTotal: 0,
        archivedHasMore: false,
        archivedIndexLoading: false,
        archivedSearch: "",
        archiveSectionOpen: false,
        onToggleArchiveSection: () => {},
        onArchiveSearch: () => {},
        onArchiveLoadMore: () => {},
        onArchiveSelect: () => {},
      }),
    );
  });

  return container.querySelector<HTMLElement>(".run-list__tree");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  vi.unstubAllGlobals();
});

describe("WorkspaceRunTree keyboard behavior", () => {
  it("ArrowLeft로 workspace에 포커스를 옮겨도 선택된 run으로 다시 튀지 않는다", async () => {
    const tree = await renderWorkspaceRunTree();
    expect(tree).not.toBeNull();
    if (!tree) {
      throw new Error("workspace tree missing");
    }

    const activeRunBefore = tree.querySelector<HTMLElement>('[data-tree-id^="run-"][tabindex="0"]');
    expect(activeRunBefore).not.toBeNull();

    await act(async () => {
      tree.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });

    const activeWorkspaceAfter = tree.querySelector<HTMLElement>(
      '[data-tree-id^="workspace-"][tabindex="0"]',
    );
    const activeRunAfter = tree.querySelector<HTMLElement>('[data-tree-id^="run-"][tabindex="0"]');

    expect(activeWorkspaceAfter).not.toBeNull();
    expect(activeRunAfter).toBeNull();
  });
});
