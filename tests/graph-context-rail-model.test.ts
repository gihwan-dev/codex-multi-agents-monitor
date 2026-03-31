import { describe, expect, it } from "vitest";
import type { ContextObservabilityModel } from "../src/entities/run/index.js";
import { buildGraphContextRailPresentation } from "../src/widgets/causal-graph/ui/graphContextRailModel.js";

function buildObservabilityModel(): ContextObservabilityModel {
  const timelinePoints: ContextObservabilityModel["timelinePoints"] = [
    {
      eventId: "event-1",
      eventTitle: "Prompt",
      laneId: "lane-main",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cumulativeContextTokens: 0,
      contextWindowTokens: 0,
      hasMeasuredContextState: false,
      hasMeasuredRuntimeUsage: false,
      hasCompaction: false,
    },
    {
      eventId: "event-2",
      eventTitle: "Assistant",
      laneId: "lane-main",
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cumulativeContextTokens: 1_200,
      contextWindowTokens: 950,
      hasMeasuredContextState: true,
      hasMeasuredRuntimeUsage: true,
      hasCompaction: false,
    },
    {
      eventId: "event-3",
      eventTitle: "Waiting",
      laneId: "lane-main",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cumulativeContextTokens: 1_200,
      contextWindowTokens: 950,
      hasMeasuredContextState: true,
      hasMeasuredRuntimeUsage: false,
      hasCompaction: false,
    },
  ];

  return {
    activeEventId: "event-3",
    activeEventTitle: "Waiting",
    activeLaneId: "lane-main",
    activeSource: "viewport",
    activeContextWindowTokens: 950,
    activeCumulativeContextTokens: 1_200,
    peakContextWindowTokens: 950,
    peakCumulativeContextTokens: 1_200,
    maxContextWindowTokens: null,
    laneSummaries: [],
    timelinePoints,
    pointsByEventId: new Map(timelinePoints.map((point) => [point.eventId, point])),
  };
}

describe("graphContextRailModel", () => {
  it("uses the latest measured runtime event as the cause for a carried-forward active point", () => {
    const presentation = buildGraphContextRailPresentation({
      observability: buildObservabilityModel(),
    });

    expect(presentation).not.toBeNull();
    if (!presentation) {
      throw new Error("expected graph context rail presentation");
    }

    expect(presentation.activeEventLabel).toBe("Waiting");
    expect(presentation.causeEventLabel).toBe("Assistant");
  });
});
