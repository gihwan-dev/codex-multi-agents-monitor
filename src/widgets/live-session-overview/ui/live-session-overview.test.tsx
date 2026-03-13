import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { findSelectedSession, formatTimestamp } from "@/entities/session";
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <LiveSessionOverview
      collapsed={collapsed}
      degradedMessage={null}
      errorMessage={null}
      loading={false}
      onCollapsedChange={setCollapsed}
      selectedSession={selectedSession}
      snapshot={state.snapshot}
    />
  );
}

describe("LiveSessionOverview", () => {
  it("keeps the compact summary bar visible and collapses the expanded body", () => {
    render(<LiveSessionOverviewHarness />);

    const summary = screen.getByTestId("live-session-summary");
    const summaryBar = screen.getByTestId("live-session-summary-bar");

    expect(summary).toHaveAttribute("data-state", "expanded");
    expect(within(summaryBar).getByText("Liquid Glass shell redesign")).toBeVisible();
    expect(within(summaryBar).getByText("Healthy")).toBeVisible();
    expect(
      within(summaryBar).getByText(formatTimestamp("2026-03-12T12:29:30.000Z")),
    ).toBeVisible();
    expect(screen.getByText("Selected session")).toBeVisible();

    fireEvent.click(screen.getByTestId("live-session-summary-trigger"));

    expect(summary).toHaveAttribute("data-state", "collapsed");
    expect(within(summaryBar).getByText("Liquid Glass shell redesign")).toBeVisible();
    expect(within(summaryBar).getByText("Healthy")).toBeVisible();

    const selectedSessionHeading = screen.queryByText("Selected session");
    if (selectedSessionHeading) {
      expect(selectedSessionHeading).not.toBeVisible();
    }
  });
});
