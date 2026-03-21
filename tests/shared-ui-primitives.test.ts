// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EventTypeGlyph,
  StatusChip,
} from "../src/shared/ui/index.js";

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

describe("shared ui primitives", () => {
  it("StatusChip은 상태 라벨과 subtle 스타일을 함께 렌더링한다", async () => {
    await act(async () => {
      root.render(createElement(StatusChip, { status: "blocked", subtle: true }));
    });

    const chip = container.querySelector<HTMLElement>('[data-slot="monitor-status-chip"]');
    const glyph = container.querySelector<HTMLElement>('[data-slot="monitor-status-glyph"]');

    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain("Blocked");
    expect(chip?.dataset.subtle).toBe("true");
    expect(chip?.dataset.status).toBe("blocked");
    expect(glyph?.dataset.status).toBe("blocked");
  });

  it("EventTypeGlyph는 이벤트 타입에 맞는 semantic metadata를 렌더링한다", async () => {
    await act(async () => {
      root.render(
        createElement(EventTypeGlyph, {
          eventType: "tool.finished",
          size: 18,
          className: "extra",
        }),
      );
    });

    const icon = container.querySelector<SVGElement>('[data-slot="event-type-glyph"]');

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("width")).toBe("18");
    expect(icon?.dataset.eventType).toBe("tool.finished");
    expect(icon?.getAttribute("class")).toContain("extra");
  });
});
