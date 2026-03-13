import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { findSelectedSession, formatTimestamp } from "@/entities/session";
import { buildTimelineProjection } from "@/features/timeline";
import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { LiveSessionOverview } from "./live-session-overview";

afterEach(() => {
  cleanup();
});

function LiveSessionOverviewHarness() {
  const state = resolveMonitorUiQaState("?demo=ui-qa&tab=live&session=sess-ui-shell");

  if (!state) {
    throw new Error("Expected UI-QA state");
  }

  const selectedSession = findSelectedSession(state.snapshot, state.selectedSessionId);
  const projection = buildTimelineProjection(state.detailBySessionId[state.selectedSessionId] ?? null);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <LiveSessionOverview
      collapsed={collapsed}
      degradedMessage={null}
      errorMessage={null}
      loading={false}
      onCollapsedChange={setCollapsed}
      projection={projection}
      selectedSession={selectedSession}
      snapshot={state.snapshot}
    />
  );
}

describe("LiveSessionOverview", () => {
  it("확장 상태에서 협업 중심 요약만 노출하고 generic 카드 문구를 제거한다", () => {
    render(<LiveSessionOverviewHarness />);

    const summary = screen.getByTestId("live-session-summary");
    const summaryBar = screen.getByTestId("live-session-summary-bar");

    expect(summary).toHaveAttribute("data-state", "expanded");
    expect(within(summaryBar).getByText("Liquid Glass shell redesign")).toBeVisible();
    expect(within(summaryBar).getByText("Healthy")).toBeVisible();
    expect(within(summaryBar).getByText("Updated")).toBeVisible();
    expect(
      within(summaryBar).getByText(formatTimestamp("2026-03-12T12:29:30.000Z")),
    ).toBeVisible();

    const coordination = screen.getByTestId("live-session-coordination");
    expect(within(coordination).getByText("Current turn")).toBeVisible();
    expect(within(coordination).getByText("Turn 2")).toBeVisible();
    expect(within(coordination).getByText("Participants")).toBeVisible();
    expect(within(coordination).getByText("2 agent lanes")).toBeVisible();
    expect(within(coordination).getByText("Main · Newton")).toBeVisible();
    expect(within(coordination).getByText("Latest coordination")).toBeVisible();
    expect(within(coordination).getByText(/Handoff ·/)).toBeVisible();
    expect(screen.queryByText("Selected session")).not.toBeInTheDocument();
    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
  });

  it("접으면 compact toolbar만 유지하고 coordination summary를 숨긴다", () => {
    render(<LiveSessionOverviewHarness />);

    const summary = screen.getByTestId("live-session-summary");
    const summaryBar = screen.getByTestId("live-session-summary-bar");

    fireEvent.click(screen.getByTestId("live-session-summary-trigger"));

    expect(summary).toHaveAttribute("data-state", "collapsed");
    expect(within(summaryBar).getByText("Liquid Glass shell redesign")).toBeVisible();
    expect(within(summaryBar).getByText("Healthy")).toBeVisible();
    expect(screen.queryByTestId("live-session-coordination")).not.toBeInTheDocument();
    expect(screen.queryByText("Current turn")).not.toBeInTheDocument();
  });
});
