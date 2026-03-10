import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveOverviewShell } from "@/features/overview/ui/live-overview-shell";
import type { LiveOverviewThread } from "@/shared/types/contracts";

const NOW_ISO = "2026-03-10T11:00:00Z";
const WINDOW_STARTED_AT = "2026-03-10T09:50:00Z";
const WINDOW_ENDED_AT = "2026-03-10T10:00:00Z";

function buildThread(
  overrides: Partial<LiveOverviewThread> & {
    thread_id: string;
    title: string;
  },
): LiveOverviewThread {
  const { thread_id, title, ...rest } = overrides;

  return {
    thread_id,
    title,
    cwd: "/workspace/default",
    status: "inflight",
    started_at: "2026-03-10T09:30:00Z",
    updated_at: NOW_ISO,
    latest_activity_summary: "recent commentary",
    agent_roles: [],
    bottleneck_level: "normal",
    longest_wait_ms: null,
    active_tool_name: null,
    active_tool_ms: null,
    mini_timeline_window_started_at: WINDOW_STARTED_AT,
    mini_timeline_window_ended_at: WINDOW_ENDED_AT,
    mini_timeline: [],
    ...rest,
  };
}

describe("LiveOverviewShell", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(new Date(NOW_ISO).getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters threads by workspace, role, and severity", async () => {
    const user = userEvent.setup();
    const threads = [
      buildThread({
        thread_id: "thread-alpha",
        title: "Alpha",
        cwd: "/workspace/alpha",
      }),
      buildThread({
        thread_id: "thread-beta",
        title: "Beta",
        cwd: "/workspace/beta",
        bottleneck_level: "warning",
      }),
      buildThread({
        thread_id: "thread-gamma",
        title: "Gamma",
        cwd: "/workspace/beta",
        agent_roles: ["implementer"],
        bottleneck_level: "critical",
      }),
      buildThread({
        thread_id: "thread-delta",
        title: "Delta",
        cwd: "/workspace/alpha",
        agent_roles: ["reviewer"],
        bottleneck_level: "warning",
      }),
    ];

    render(
      <MemoryRouter>
        <LiveOverviewShell isLoading={false} threads={threads} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("live-thread-thread-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("live-thread-thread-beta")).toBeInTheDocument();
    expect(screen.getByTestId("live-thread-thread-gamma")).toBeInTheDocument();
    expect(screen.getByTestId("live-thread-thread-delta")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Workspace filter"),
      "/workspace/alpha",
    );
    expect(screen.getByTestId("live-thread-thread-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("live-thread-thread-delta")).toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-beta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-gamma"),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Workspace filter"), "all");
    await user.selectOptions(
      screen.getByLabelText("Role filter"),
      "implementer",
    );
    expect(screen.getByTestId("live-thread-thread-gamma")).toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-alpha"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-beta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-delta"),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Role filter"), "all");
    await user.selectOptions(screen.getByLabelText("Status filter"), "warning");
    expect(screen.getByTestId("live-thread-thread-beta")).toBeInTheDocument();
    expect(screen.getByTestId("live-thread-thread-delta")).toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-alpha"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("live-thread-thread-gamma"),
    ).not.toBeInTheDocument();
  });

  it("renders bottleneck ranking, wait/tool badges, and mini timeline segments", () => {
    const threads = [
      buildThread({
        thread_id: "thread-normal",
        title: "Normal newest",
        updated_at: "2026-03-10T10:00:00Z",
      }),
      buildThread({
        thread_id: "thread-warning-tool",
        title: "Warning tool",
        updated_at: "2026-03-10T09:59:00Z",
        bottleneck_level: "warning",
        active_tool_name: "exec_command",
        active_tool_ms: 50_000,
      }),
      buildThread({
        thread_id: "thread-critical-high",
        title: "Critical higher wait",
        updated_at: "2026-03-10T09:58:00Z",
        agent_roles: ["implementer", "reviewer"],
        bottleneck_level: "critical",
        longest_wait_ms: 300_000,
        active_tool_name: "exec_command",
        active_tool_ms: 50_000,
        mini_timeline: [
          {
            kind: "wait",
            started_at: "2026-03-10T09:55:00Z",
            ended_at: "2026-03-10T10:00:00Z",
          },
          {
            kind: "tool",
            started_at: "2026-03-10T09:59:10Z",
            ended_at: "2026-03-10T10:00:00Z",
          },
          {
            kind: "message",
            started_at: "2026-03-10T09:59:40Z",
            ended_at: null,
          },
        ],
      }),
      buildThread({
        thread_id: "thread-critical-low",
        title: "Critical lower wait",
        updated_at: "2026-03-10T09:57:00Z",
        bottleneck_level: "critical",
        longest_wait_ms: 150_000,
      }),
    ];

    render(
      <MemoryRouter>
        <LiveOverviewShell isLoading={false} threads={threads} />
      </MemoryRouter>,
    );

    const ranking = within(screen.getByLabelText("Bottleneck ranking"));
    expect(
      ranking.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Critical higher wait"),
      expect.stringContaining("Critical lower wait"),
      expect.stringContaining("Warning tool"),
      expect.stringContaining("Normal newest"),
    ]);
    expect(
      screen.getByTestId("bottleneck-thread-critical-high"),
    ).toBeInTheDocument();

    const miniTimeline = screen.getByTestId(
      "mini-timeline-thread-critical-high",
    );
    const row = miniTimeline.closest("li");
    expect(row).not.toBeNull();
    const scopedRow = within(row as HTMLLIElement);
    expect(scopedRow.getByText("wait 5m")).toBeInTheDocument();
    expect(scopedRow.getByText("tool exec_command 50s")).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "mini-timeline-thread-critical-high-wait-2026-03-10T09:55:00Z",
      ),
    ).toHaveStyle({
      left: "50%",
      width: "50%",
    });
    expect(
      within(miniTimeline).getAllByTestId(
        /mini-timeline-thread-critical-high-/,
      ),
    ).toHaveLength(3);
  });
});
