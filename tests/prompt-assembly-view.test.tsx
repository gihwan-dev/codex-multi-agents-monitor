// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PromptAssemblyView } from "../src/widgets/prompt-assembly/ui/PromptAssemblyView.js";
import type { PromptAssembly } from "../src/entities/run/index.js";

const assembly: PromptAssembly = {
  layers: [
    {
      layerId: "layer-0",
      layerType: "system",
      label: "System Prompt",
      contentLength: 42,
      preview: "preview only",
      rawContent: "super secret system prompt",
    },
  ],
  totalContentLength: 42,
};

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

describe("PromptAssemblyView", () => {
  it("접힌 상태에서는 preview를 표시한다", async () => {
    await act(async () => {
      root.render(createElement(PromptAssemblyView, { assembly }));
    });

    expect(container.textContent).toContain("preview only");
  });

  it("펼치면 rawContent를 line-clamp로 표시한다", async () => {
    await act(async () => {
      root.render(createElement(PromptAssemblyView, { assembly }));
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

  it("rawContent가 없으면 preview를 표시한다", async () => {
    const noRawAssembly: PromptAssembly = {
      layers: [
        {
          layerId: "layer-0",
          layerType: "system",
          label: "System Prompt",
          contentLength: 42,
          preview: "fallback preview text",
          rawContent: null,
        },
      ],
      totalContentLength: 42,
    };

    await act(async () => {
      root.render(createElement(PromptAssemblyView, { assembly: noRawAssembly }));
    });

    const header = container.querySelector<HTMLButtonElement>('[data-slot="prompt-layer-toggle"]');
    if (!header) {
      throw new Error("prompt assembly header missing");
    }

    await act(async () => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("fallback preview text");
  });
});
