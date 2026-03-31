// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContextObservabilityModel } from "../src/entities/run/index.js";
import { MonitorContextObservabilityPanel } from "../src/widgets/monitor-chrome/ui/MonitorContextObservabilityPanel.js";

let container: HTMLDivElement;
let root: Root;

function createObservability(eventId: string, laneId: string): ContextObservabilityModel {
  const point = {
    eventId,
    eventTitle: `Event ${eventId}`,
    laneId,
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    cumulativeContextTokens: 600,
    contextWindowTokens: 240,
    hasCompaction: false,
  };

  return {
    activeEventId: eventId,
    activeEventTitle: point.eventTitle,
    activeLaneId: laneId,
    activeSource: "viewport",
    activeContextWindowTokens: point.contextWindowTokens,
    activeCumulativeContextTokens: point.cumulativeContextTokens,
    peakContextWindowTokens: point.contextWindowTokens,
    peakCumulativeContextTokens: point.cumulativeContextTokens,
    maxContextWindowTokens: 1_000,
    laneSummaries: [
      {
        laneId,
        laneName: `Lane ${laneId}`,
        laneRole: "main",
        laneKind: "main",
        inputTokens: point.inputTokens,
        outputTokens: point.outputTokens,
        totalTokens: point.totalTokens,
        contextImportedTokens: 0,
        contextReturnedTokens: 0,
        compactionCount: 0,
        shareOfTotalContext: 1,
        estimatedMainContextSaved: 0,
        isSelected: true,
      },
    ],
    timelinePoints: [point],
    pointsByEventId: new Map([[eventId, point]]),
  };
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

describe("MonitorContextObservabilityPanel", () => {
  it("resets the lane summary disclosure when the run changes", async () => {
    const firstObservability = createObservability("event-1", "lane-1");
    const secondObservability = createObservability("event-2", "lane-2");

    await act(async () => {
      root.render(
        createElement(MonitorContextObservabilityPanel, {
          observability: firstObservability,
        }),
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>('[data-slot="lane-summary-toggle"]');
    expect(toggle).not.toBeNull();
    if (!toggle) {
      throw new Error("lane summary toggle missing");
    }

    await act(async () => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      root.render(
        createElement(MonitorContextObservabilityPanel, {
          observability: secondObservability,
        }),
      );
    });

    expect(
      container
        .querySelector<HTMLButtonElement>('[data-slot="lane-summary-toggle"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
