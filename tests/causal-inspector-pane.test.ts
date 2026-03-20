import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../src/entities/run/index.js";
import { CausalInspectorPane } from "../src/widgets/causal-inspector/index.js";

const noop = () => undefined;

function buildSelection(id: string): SelectionState {
  return { kind: "event", id };
}

function buildSummary(): InspectorCausalSummary {
  return {
    title: "Blocked tool handoff",
    preview: "Planner is waiting on a failing fetch.",
    facts: [
      { label: "Run", value: "trace-fix-002" },
      { label: "Agent", value: "planner" },
      { label: "Wait", value: "tool result" },
      { label: "Extra", value: "should be hidden in compact summary" },
    ],
    whyBlocked: "The fetch tool returned a retryable upstream error.",
    upstream: [
      {
        label: "Fetch tool",
        description: "Retry budget exhausted while calling origin API.",
        selection: buildSelection("event-fetch"),
      },
      {
        label: "Planner prompt",
        description: "The prompt asked for the missing dataset.",
        selection: buildSelection("event-prompt"),
      },
    ],
    downstream: [
      {
        label: "Reviewer",
        description: "Waiting for planner output.",
        selection: buildSelection("event-review"),
      },
    ],
    nextAction: "Retry with cached fallback data before handing off again.",
    payloadPreview: "tool call failed with ECONNRESET",
    rawStatusLabel: "Raw hidden by default",
    affectedAgentCount: 2,
    downstreamWaitingCount: 1,
  };
}

function renderInspector(
  props: Partial<Parameters<typeof CausalInspectorPane>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(CausalInspectorPane, {
      summary: buildSummary(),
      onSelectJump: noop,
      onOpenDrawer: (_tab: DrawerTab) => noop(),
      onToggleOpen: noop,
      open: true,
      compact: false,
      ...props,
    }),
  );
}

describe("CausalInspectorPane", () => {
  it("열린 inspector는 핵심 원인과 payload 액션을 함께 렌더링한다", () => {
    const markup = renderInspector();

    expect(markup).toContain("Direct cause");
    expect(markup).toContain("Upstream chain");
    expect(markup).toContain("Downstream impact");
    expect(markup).toContain("Suggested next");
    expect(markup).toContain("2 agents affected · 1 waiting");
    expect(markup).toContain("Fetch tool");
    expect(markup).toContain("Retry with cached fallback data before handing off again.");
    expect(markup).toContain("Artifacts");
    expect(markup).toContain("Context");
    expect(markup).toContain("Log");
    expect(markup).toContain("Raw");
    expect(markup).toContain("Close");
  });

  it("compact로 닫힌 inspector는 요약과 상위 세 개 fact만 미리보기로 보여준다", () => {
    const markup = renderInspector({ open: false, compact: true });

    expect(markup).toContain("Selection summary");
    expect(markup).toContain("Blocked tool handoff");
    expect(markup).toContain("trace-fix-002");
    expect(markup).toContain("planner");
    expect(markup).toContain("tool result");
    expect(markup).not.toContain("should be hidden in compact summary");
    expect(markup).toContain("Open");
  });

  it("요약이 없으면 비어 있는 inspector 안내 문구를 렌더링한다", () => {
    const markup = renderInspector({ summary: null });

    expect(markup).toContain("Select a row, edge, or artifact to inspect its causal summary.");
    expect(markup).toContain("No payload preview yet.");
    expect(markup).not.toContain("Direct cause");
  });
});
