// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TextViewerModal,
  type TextViewerSection,
} from "../src/shared/ui/monitor/TextViewerModal.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function renderModal(sections: TextViewerSection[], open = true) {
  act(() => {
    root.render(
      createElement(TextViewerModal, {
        open,
        onOpenChange: () => {},
        title: "Test Title",
        description: "Test description",
        sections,
      }),
    );
  });
}

describe("TextViewerModal", () => {
  it("단일 섹션일 때 탭 없이 내용을 직접 렌더링한다", () => {
    renderModal([{ label: "Output", content: "Hello world" }]);

    const modal = document.querySelector('[data-slot="text-viewer-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain("Test Title");
    expect(modal?.textContent).toContain("Hello world");

    const tabsList = modal?.querySelector('[data-slot="tabs-list"]');
    expect(tabsList).toBeNull();
  });

  it("복수 섹션일 때 탭 UI를 렌더링한다", () => {
    renderModal([
      { label: "Input", content: "input text" },
      { label: "Output", content: "output text" },
    ]);

    const modal = document.querySelector('[data-slot="text-viewer-modal"]');
    const tabsList = modal?.querySelector('[data-slot="tabs-list"]');
    expect(tabsList).not.toBeNull();

    const triggers = modal?.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers?.length).toBe(2);
    expect(triggers?.[0]?.textContent).toBe("Input");
    expect(triggers?.[1]?.textContent).toBe("Output");
  });

  it("content가 null이면 placeholder를 표시한다", () => {
    renderModal([{ label: "Output", content: null, placeholder: "비어 있음" }]);

    const placeholder = document.querySelector('[data-slot="text-viewer-placeholder"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toBe("비어 있음");
  });

  it("content가 null이고 placeholder가 없으면 기본 메시지를 표시한다", () => {
    renderModal([{ label: "Output", content: null }]);

    const placeholder = document.querySelector('[data-slot="text-viewer-placeholder"]');
    expect(placeholder?.textContent).toBe("No content available.");
  });

  it("open=false이면 모달이 렌더링되지 않는다", () => {
    renderModal([{ label: "Output", content: "test" }], false);

    const modal = document.querySelector('[data-slot="text-viewer-modal"]');
    expect(modal).toBeNull();
  });

  it("content가 있을 때 copy 버튼을 렌더링한다", () => {
    renderModal([{ label: "Output", content: "copyable text" }]);

    const modal = document.querySelector('[data-slot="text-viewer-modal"]');
    const copyButton = modal?.querySelector('[aria-label="Copy to clipboard"]');
    expect(copyButton).not.toBeNull();
  });

  it("content가 null이면 copy 버튼을 렌더링하지 않는다", () => {
    renderModal([{ label: "Output", content: null }]);

    const modal = document.querySelector('[data-slot="text-viewer-modal"]');
    const copyButton = modal?.querySelector('[aria-label="Copy to clipboard"]');
    expect(copyButton).toBeNull();
  });

  it("description이 제공되면 렌더링한다", () => {
    renderModal([{ label: "Output", content: "test" }]);

    const modal = document.querySelector('[data-slot="text-viewer-modal"]');
    expect(modal?.textContent).toContain("Test description");
  });
});
