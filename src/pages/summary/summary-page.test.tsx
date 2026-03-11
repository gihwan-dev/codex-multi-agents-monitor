import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SummaryPage } from "@/pages/summary/summary-page";
import { getSummaryDashboard } from "@/shared/lib/tauri/commands";
import type {
  SummaryDashboardFilters,
  SummaryDashboardPayload,
} from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  getSummaryDashboard: vi.fn(),
}));

function buildPayload(
  filters: SummaryDashboardFilters = {},
): SummaryDashboardPayload {
  const workspace = filters.workspace ?? "/workspace/alpha";
  const sessionId = filters.session_id ?? "thread-alpha";

  return {
    filters,
    kpis: {
      session_count: workspace === "/workspace/alpha" ? 1 : 2,
      active_session_count: 0,
      completed_session_count: workspace === "/workspace/alpha" ? 1 : 2,
      average_duration_ms: workspace === "/workspace/alpha" ? 180_000 : 240_000,
      workspace_count: workspace === "/workspace/alpha" ? 1 : 2,
    },
    workspace_distribution: [
      {
        workspace,
        session_count: workspace === "/workspace/alpha" ? 1 : 2,
        average_duration_ms:
          workspace === "/workspace/alpha" ? 180_000 : 240_000,
        latest_updated_at: "2026-03-10T10:00:00Z",
      },
    ],
    role_mix: [
      {
        agent_role: "implementer",
        session_count: 1,
        average_duration_ms: 180_000,
      },
      {
        agent_role: "reviewer",
        session_count: workspace === "/workspace/alpha" ? 0 : 1,
        average_duration_ms: workspace === "/workspace/alpha" ? null : 300_000,
      },
    ],
    session_compare: [
      {
        session_id: sessionId,
        title:
          workspace === "/workspace/alpha" ? "Alpha session" : "Beta session",
        workspace,
        status: "completed",
        updated_at: "2026-03-10T10:00:00Z",
        latest_activity_summary: "summary ready",
        duration_ms: 180_000,
        agent_roles: ["implementer"],
      },
    ],
  };
}

function renderSummaryPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SummaryPage />
    </QueryClientProvider>,
  );
}

describe("SummaryPage", () => {
  beforeEach(() => {
    vi.mocked(getSummaryDashboard).mockReset();
    vi.mocked(getSummaryDashboard).mockImplementation(async (filters = {}) =>
      buildPayload(filters),
    );
  });

  it("session_id와 workspace 필터를 사용해 dashboard를 갱신한다", async () => {
    const user = userEvent.setup();

    renderSummaryPage();

    expect(await screen.findByText("필터 기반 Summary")).toBeInTheDocument();
    expect(await screen.findByText("summary ready")).toBeInTheDocument();
    expect(getSummaryDashboard).toHaveBeenCalledWith({});

    await user.selectOptions(
      screen.getByLabelText("Workspace"),
      "/workspace/alpha",
    );
    await user.selectOptions(screen.getByLabelText("Session"), "thread-alpha");
    await user.click(screen.getByRole("button", { name: "필터 적용" }));

    await waitFor(() => {
      expect(getSummaryDashboard).toHaveBeenLastCalledWith({
        workspace: "/workspace/alpha",
        session_id: "thread-alpha",
      });
    });

    expect(screen.getByText("Workspace distribution")).toBeInTheDocument();
    expect(screen.getByText("Role mix")).toBeInTheDocument();
    expect(screen.getByText("Session compare")).toBeInTheDocument();
  });
});
