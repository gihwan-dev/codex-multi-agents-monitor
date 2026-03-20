// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventTypeGlyph } from "../src/shared/ui/EventTypeGlyph.js";
import { StatusChip } from "../src/shared/ui/StatusChip.js";

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

    const chip = container.querySelector<HTMLElement>(".status-chip");
    const glyph = container.querySelector<HTMLElement>(".status-chip__glyph");

    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain("Blocked");
    expect(chip?.classList.contains("status-chip--subtle")).toBe(true);
    expect(glyph?.classList.contains("status-chip__glyph--blocked")).toBe(true);
  });

  it("EventTypeGlyph는 이벤트 타입에 맞는 아이콘 클래스를 렌더링한다", async () => {
    await act(async () => {
      root.render(
        createElement(EventTypeGlyph, {
          eventType: "tool.finished",
          size: 18,
          className: "extra",
        }),
      );
    });

    const icon = container.querySelector<SVGElement>("svg");

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("width")).toBe("18");
    expect(icon?.getAttribute("class")).toContain("event-icon--tool-finished");
    expect(icon?.getAttribute("class")).toContain("extra");
  });
});
