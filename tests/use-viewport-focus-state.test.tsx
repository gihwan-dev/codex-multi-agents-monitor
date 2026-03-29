// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useViewportFocusState } from "../src/pages/monitor/ui/useViewportFocusState.js";

let container: HTMLDivElement;
let root: Root;

function ViewportFocusProbe({
  activeTraceId,
  initialViewportFocusEventId,
  nextViewportFocusEventId,
}: {
  activeTraceId: string | null;
  initialViewportFocusEventId: string | null;
  nextViewportFocusEventId: string | null;
}) {
  const { viewportFocusEventId, setViewportFocusEventId } = useViewportFocusState(
    activeTraceId,
    initialViewportFocusEventId,
  );

  return createElement(
    "div",
    null,
    createElement("output", { "data-slot": "viewport-focus" }, viewportFocusEventId ?? "none"),
    createElement(
      "button",
      {
        type: "button",
        onClick: () => setViewportFocusEventId(nextViewportFocusEventId),
      },
      "set focus",
    ),
  );
}

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

describe("useViewportFocusState", () => {
  it("uses the first visible event as the initial focus", async () => {
    await act(async () => {
      root.render(
        createElement(ViewportFocusProbe, {
          activeTraceId: "run-1",
          initialViewportFocusEventId: "event-1",
          nextViewportFocusEventId: "event-9",
        }),
      );
    });

    expect(container.querySelector('[data-slot="viewport-focus"]')?.textContent).toBe(
      "event-1",
    );
  });

  it("switches to the next trace's initial viewport focus without keeping the prior trace state", async () => {
    await act(async () => {
      root.render(
        createElement(ViewportFocusProbe, {
          activeTraceId: "run-1",
          initialViewportFocusEventId: "event-1",
          nextViewportFocusEventId: "event-9",
        }),
      );
    });

    const setFocusButton = container.querySelector("button");
    expect(setFocusButton).not.toBeNull();
    if (!setFocusButton) {
      throw new Error("set focus button missing");
    }

    await act(async () => {
      setFocusButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-slot="viewport-focus"]')?.textContent).toBe(
      "event-9",
    );

    await act(async () => {
      root.render(
        createElement(ViewportFocusProbe, {
          activeTraceId: "run-2",
          initialViewportFocusEventId: "event-2",
          nextViewportFocusEventId: "event-7",
        }),
      );
    });

    expect(container.querySelector('[data-slot="viewport-focus"]')?.textContent).toBe(
      "event-2",
    );
  });
});
