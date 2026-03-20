// @vitest-environment jsdom

import { act, type ComponentProps, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchivedSessionList } from "../src/widgets/workspace-run-tree/index.js";

let container: HTMLDivElement;
let root: Root;
let observerInstances: IntersectionObserverStub[];

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

class IntersectionObserverStub {
  callback: IntersectionObserverCallback;
  target: Element | null = null;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observerInstances.push(this);
  }

  observe(target: Element) {
    this.target = target;
  }

  disconnect() {}

  trigger(isIntersecting = true) {
    if (!this.target) {
      return;
    }

    this.callback(
      [{ isIntersecting, target: this.target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function installIntersectionObserverStub() {
  observerInstances = [];
  vi.stubGlobal(
    "IntersectionObserver",
    IntersectionObserverStub as unknown as typeof IntersectionObserver,
  );
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

async function updateSearchInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  await act(async () => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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

    await updateSearchInput(input, "planner");

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

  it("load-more sentinel이 교차되면 다음 페이지를 요청한다", async () => {
    const { onLoadMore } = await renderArchivedSessionList();

    expect(observerInstances).toHaveLength(1);

    await act(async () => {
      observerInstances[0]?.trigger(true);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("workspace 그룹을 펼치고 archived session을 선택할 수 있다", async () => {
    const { onSelect } = await renderArchivedSessionList({ hasMore: false, total: 1 });
    const workspaceButton = container.querySelector<HTMLButtonElement>(
      ".archive-list__workspace .run-list__workspace-row",
    );

    expect(workspaceButton).not.toBeNull();
    if (!workspaceButton) {
      throw new Error("archive workspace button missing");
    }

    await act(async () => {
      workspaceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const sessionButton = container.querySelector<HTMLButtonElement>(".archive-list__workspace .run-row");
    expect(sessionButton?.textContent).toContain("Check archive search behavior");

    if (!sessionButton) {
      throw new Error("archive session button missing");
    }

    await act(async () => {
      sessionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith(baseItem.filePath);
  });
});
