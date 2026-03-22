// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PromptAssembly } from "../src/entities/run/index.js";
import { PromptAssemblyView } from "../src/widgets/prompt-assembly/index.js";

let container: HTMLDivElement;
let root: Root;

const assembly: PromptAssembly = {
  totalContentLength: 42,
  layers: [
    {
      layerId: "layer-1",
      layerType: "system",
      label: "System",
      preview: "preview only",
      contentLength: 42,
      rawContent: "super secret system prompt",
    },
  ],
};

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

describe("PromptAssemblyView", () => {
  it("raw가 비활성화되면 preview는 유지하고 상세 원문은 숨긴다", async () => {
    await act(async () => {
      root.render(createElement(PromptAssemblyView, { assembly, rawEnabled: false }));
    });

    expect(container.textContent).toContain("preview only");

    const header = container.querySelector<HTMLButtonElement>('[data-slot="prompt-layer-toggle"]');
    if (!header) {
      throw new Error("prompt assembly header missing");
    }

    await act(async () => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Raw context hidden by default.");
    expect(container.textContent).not.toContain("super secret system prompt");
  });

  it("raw가 활성화되면 상세 원문을 렌더링한다", async () => {
    await act(async () => {
      root.render(createElement(PromptAssemblyView, { assembly, rawEnabled: true }));
    });

    const header = container.querySelector<HTMLButtonElement>('[data-slot="prompt-layer-toggle"]');
    if (!header) {
      throw new Error("prompt assembly header missing");
    }

    await act(async () => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("super secret system prompt");
  });
});
