import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryShell } from "@/features/history/ui/history-shell";
import { openLogFile, openWorkspace } from "@/shared/lib/tauri/commands";
import type { HistorySummaryPayload } from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  openWorkspace: vi.fn(async () => undefined),
  openLogFile: vi.fn(async () => undefined),
}));

function buildSummary(): HistorySummaryPayload {
  return {
    history: {
      from_date: "2026-03-04",
      to_date: "2026-03-10",
      thread_count: 2,
      average_duration_ms: 4_200_000,
      timeout_count: 3,
      spawn_count: 5,
    },
    health: {
      missing_sources: [],
      degraded_rollout_threads: 0,
    },
    roles: [
      {
        agent_role: "reviewer",
        session_count: 2,
        average_duration_ms: 3_600_000,
        timeout_count: 2,
        spawn_count: 2,
      },
      {
        agent_role: "implementer",
        session_count: 1,
        average_duration_ms: 1_800_000,
        timeout_count: 1,
        spawn_count: 1,
      },
    ],
    slow_threads: [
      {
        thread_id: "thread-a",
        title: "History thread A",
        cwd: "/workspace/a",
        updated_at: "2026-03-10T09:00:00Z",
        latest_activity_summary: "recent commentary",
        duration_ms: 5_400_000,
        timeout_count: 2,
        spawn_count: 3,
        agent_roles: ["implementer", "reviewer"],
        rollout_path: "/tmp/thread-a.jsonl",
      },
      {
        thread_id: "thread-b",
        title: "History thread B",
        cwd: "/workspace/b",
        updated_at: "2026-03-09T23:00:00Z",
        latest_activity_summary: null,
        duration_ms: 3_600_000,
        timeout_count: 1,
        spawn_count: 2,
        agent_roles: [],
        rollout_path: null,
      },
    ],
  };
}

describe("HistoryShell 컴포넌트", () => {
  beforeEach(() => {
    vi.mocked(openWorkspace).mockReset();
    vi.mocked(openWorkspace).mockResolvedValue(undefined);
    vi.mocked(openLogFile).mockReset();
    vi.mocked(openLogFile).mockResolvedValue(undefined);
  });

  it("최근 7일 KPI와 role breakdown, slow thread retrospective를 렌더한다", () => {
    render(<HistoryShell summary={buildSummary()} isLoading={false} />);

    expect(
      screen.getByText("최근 2026-03-04 ~ 2026-03-10"),
    ).toBeInTheDocument();
    expect(screen.getByText("threads")).toBeInTheDocument();
    expect(screen.getByText("average duration")).toBeInTheDocument();
    expect(screen.getAllByText("timeouts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("spawns").length).toBeGreaterThan(0);
    expect(screen.getByText("reviewer")).toBeInTheDocument();
    expect(screen.getByText("History thread A")).toBeInTheDocument();
    expect(screen.getByText("recent commentary")).toBeInTheDocument();
    expect(screen.queryByText(/누락된 source:/)).not.toBeInTheDocument();
  });

  it("workspace와 log deep link를 올바른 인자로 호출한다", async () => {
    const user = userEvent.setup();
    render(<HistoryShell summary={buildSummary()} isLoading={false} />);

    await user.click(
      screen.getAllByRole("button", { name: "workspace 열기" })[0],
    );
    await user.click(screen.getAllByRole("button", { name: "log 열기" })[0]);

    expect(openWorkspace).toHaveBeenCalledWith("/workspace/a");
    expect(openLogFile).toHaveBeenCalledWith("/tmp/thread-a.jsonl");
  });

  it("rollout path가 없으면 log 버튼을 비활성화하고 open 실패를 inline error로 보여준다", async () => {
    const user = userEvent.setup();
    vi.mocked(openWorkspace).mockRejectedValue({
      code: "open_failed",
      message: "failed to open workspace",
    });

    render(<HistoryShell summary={buildSummary()} isLoading={false} />);

    const logButtons = screen.getAllByRole("button", { name: "log 열기" });
    expect(logButtons[1]).toBeDisabled();

    await user.click(
      screen.getAllByRole("button", { name: "workspace 열기" })[0],
    );

    expect(
      await screen.findByText("failed to open workspace"),
    ).toBeInTheDocument();
  });

  it("missing source와 partial rollout health를 상단 warning card로 보여준다", () => {
    render(
      <HistoryShell
        summary={{
          ...buildSummary(),
          health: {
            missing_sources: ["archived_sessions", "state_db"],
            degraded_rollout_threads: 2,
          },
        }}
        isLoading={false}
      />,
    );

    expect(
      screen.getByText(/누락된 source: archived sessions, state db/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2개 thread는 rollout parsing이 불완전해/),
    ).toBeInTheDocument();
  });

  it("요약 데이터가 없어도 health warning과 empty state를 함께 보여준다", () => {
    render(
      <HistoryShell
        summary={{
          ...buildSummary(),
          history: {
            ...buildSummary().history,
            thread_count: 0,
          },
          slow_threads: [],
          health: {
            missing_sources: ["live_sessions"],
            degraded_rollout_threads: 0,
          },
        }}
        isLoading={false}
      />,
    );

    expect(
      screen.getByText("누락된 source: live sessions"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("7일 요약 데이터가 아직 없습니다."),
    ).toBeInTheDocument();
  });
});
