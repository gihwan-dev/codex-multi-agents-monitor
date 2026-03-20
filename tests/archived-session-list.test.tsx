// @vitest-environment jsdom

import { act, type ComponentProps, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchivedSessionList } from "../src/widgets/workspace-run-tree/ui/ArchivedSessionList.js";

let container: HTMLDivElement;
let root: Root;

const baseItem = {
  sessionId: "session-1",
  workspacePath: "/tmp/workspace-a",
  originPath: "/tmp/workspace-a",
  displayName: "Workspace A",
  startedAt: "2026-03-20T00:00:00.000Z",
  updatedAt: "2026-03-20T00:00:00.000Z",
  model: null,
  messageCount: 1,
  filePath: "/tmp/workspace-a/session-1.json",
  firstUserMessage: "Check archive search behavior",
};

function installIntersectionObserverStub() {
  class IntersectionObserverStub {
    observe() {}
    disconnect() {}
  }

  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
}

async function renderArchivedSessionList(props?: Partial<ComponentProps<typeof ArchivedSessionList>>) {
  const onSearch = props?.onSearch ?? vi.fn();
  const onLoadMore = props?.onLoadMore ?? vi.fn();
  const onSelect = props?.onSelect ?? vi.fn();

  await act(async () => {
    root.render(
      createElement(ArchivedSessionList, {
        items: [baseItem],
        total: 3,
        hasMore: true,
        indexLoading: false,
        search: "",
        onSearch,
        onLoadMore,
        onSelect,
        ...props,
      }),
    );
  });

  return { onSearch, onLoadMore, onSelect };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installIntersectionObserverStub();
  vi.useFakeTimers();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ArchivedSessionList", () => {
  it("입력 draft와 committed 검색어가 다를 때 load-more sentinel을 숨긴다", async () => {
    const { onSearch } = await renderArchivedSessionList();
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(input).not.toBeNull();
    expect(container.querySelector(".archive-list__sentinel")).not.toBeNull();

    if (!input) {
      throw new Error("archive search input missing");
    }

    await act(async () => {
      input.value = "planner";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector(".archive-list__sentinel")).toBeNull();
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith("planner");
  });

  it("committed 검색어가 바뀌면 입력값을 동기화하고 sentinel을 다시 보여준다", async () => {
    const props = {
      items: [baseItem],
      total: 3,
      hasMore: true,
      indexLoading: false,
      search: "planner",
      onSearch: vi.fn(),
      onLoadMore: vi.fn(),
      onSelect: vi.fn(),
    };

    await renderArchivedSessionList(props);

    const input = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(input?.value).toBe("planner");
    expect(container.querySelector(".archive-list__sentinel")).not.toBeNull();
  });
});
