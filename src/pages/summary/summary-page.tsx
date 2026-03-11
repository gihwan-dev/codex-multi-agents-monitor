import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";

import { formatDuration } from "@/features/overview/lib/live-overview-formatters";
import { getSummaryDashboard } from "@/shared/lib/tauri/commands";
import type { SummaryDashboardFilters } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

export function SummaryPage() {
  const filterIds = {
    workspace: "summary-filter-workspace",
    session: "summary-filter-session",
    fromDate: "summary-filter-from-date",
    toDate: "summary-filter-to-date",
  };
  const [draftFilters, setDraftFilters] = useState({
    workspace: "",
    sessionId: "",
    fromDate: "",
    toDate: "",
  });
  const [filters, setFilters] = useState<SummaryDashboardFilters>({});
  const summaryQuery = useQuery({
    queryKey: [
      "monitor",
      "summary_dashboard",
      filters.workspace ?? null,
      filters.session_id ?? null,
      filters.from_date ?? null,
      filters.to_date ?? null,
    ],
    queryFn: () => getSummaryDashboard(filters),
  });
  const kpis = useMemo(
    () => summaryQuery.data?.kpis ?? null,
    [summaryQuery.data],
  );
  const workspaceOptions = useMemo(
    () =>
      summaryQuery.data?.workspace_distribution.map((item) => item.workspace) ??
      [],
    [summaryQuery.data],
  );
  const sessionOptions = useMemo(
    () =>
      summaryQuery.data?.session_compare.map((item) => ({
        thread_id: item.thread_id,
        title: item.title,
      })) ?? [],
    [summaryQuery.data],
  );

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Summary
        </p>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            필터 기반 Summary
          </h2>
          <p className="max-w-3xl text-sm text-[hsl(var(--muted))]">
            workspace, session, 날짜 범위를 기준으로 KPI, 분포, 비교 뷰를
            좁혀본다.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.72)] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_160px_auto_auto]">
          <FilterField id={filterIds.workspace} label="Workspace">
            <select
              id={filterIds.workspace}
              className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm"
              value={draftFilters.workspace}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  workspace: event.target.value,
                }))
              }
            >
              <option value="">All workspaces</option>
              {workspaceOptions.map((workspace) => (
                <option key={workspace} value={workspace}>
                  {workspace}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField id={filterIds.session} label="Session">
            <select
              id={filterIds.session}
              className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm"
              value={draftFilters.sessionId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  sessionId: event.target.value,
                }))
              }
            >
              <option value="">All sessions</option>
              {sessionOptions.map((session) => (
                <option key={session.thread_id} value={session.thread_id}>
                  {session.title}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField id={filterIds.fromDate} label="From">
            <input
              id={filterIds.fromDate}
              type="date"
              className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm"
              value={draftFilters.fromDate}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  fromDate: event.target.value,
                }))
              }
            />
          </FilterField>

          <FilterField id={filterIds.toDate} label="To">
            <input
              id={filterIds.toDate}
              type="date"
              className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm"
              value={draftFilters.toDate}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  toDate: event.target.value,
                }))
              }
            />
          </FilterField>

          <div className="flex items-end gap-2">
            <Button
              className="w-full"
              onClick={() => setFilters(buildFiltersFromDraft(draftFilters))}
            >
              필터 적용
            </Button>
          </div>

          <div className="flex items-end gap-2">
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => {
                setDraftFilters({
                  workspace: "",
                  sessionId: "",
                  fromDate: "",
                  toDate: "",
                });
                setFilters({});
              }}
            >
              초기화
            </Button>
          </div>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {["sessions", "active", "completed", "avg", "workspaces"].map(
              (key) => (
                <div
                  key={key}
                  className="h-28 animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]"
                />
              ),
            )}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="sessions"
              value={`${kpis?.session_count ?? 0}`}
            />
            <MetricCard
              label="active"
              value={`${kpis?.active_session_count ?? 0}`}
            />
            <MetricCard
              label="completed"
              value={`${kpis?.completed_session_count ?? 0}`}
            />
            <MetricCard
              label="avg duration"
              value={
                kpis?.average_duration_ms !== null &&
                kpis?.average_duration_ms !== undefined
                  ? formatDuration(kpis.average_duration_ms)
                  : "-"
              }
            />
            <MetricCard
              label="workspaces"
              value={`${kpis?.workspace_count ?? 0}`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
            <SummaryPanel title="Workspace distribution">
              <div className="space-y-2">
                {summaryQuery.data?.workspace_distribution.length ? (
                  summaryQuery.data.workspace_distribution.map((item) => (
                    <article
                      key={item.workspace}
                      className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.7)] px-3 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.workspace}</span>
                        <span className="text-[11px] text-[hsl(var(--muted))]">
                          {item.session_count} sessions
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                        avg{" "}
                        {item.average_duration_ms !== null
                          ? formatDuration(item.average_duration_ms)
                          : "-"}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyPanelCopy>
                    선택한 범위의 workspace가 없습니다.
                  </EmptyPanelCopy>
                )}
              </div>
            </SummaryPanel>

            <SummaryPanel title="Role mix">
              <div className="space-y-2">
                {summaryQuery.data?.role_mix.length ? (
                  summaryQuery.data.role_mix.map((item) => (
                    <article
                      key={item.agent_role}
                      className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.7)] px-3 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.agent_role}</span>
                        <span className="text-[11px] text-[hsl(var(--muted))]">
                          {item.session_count} sessions
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                        avg{" "}
                        {item.average_duration_ms !== null
                          ? formatDuration(item.average_duration_ms)
                          : "-"}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyPanelCopy>
                    선택한 범위의 role 데이터가 없습니다.
                  </EmptyPanelCopy>
                )}
              </div>
            </SummaryPanel>

            <SummaryPanel title="Session compare">
              <div className="space-y-2">
                {summaryQuery.data?.session_compare.length ? (
                  summaryQuery.data.session_compare.map((session) => (
                    <article
                      key={session.thread_id}
                      className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.7)] px-3 py-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                            {session.cwd}
                          </p>
                        </div>
                        <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[11px] text-[hsl(var(--muted))]">
                          {session.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                        {session.latest_activity_summary ??
                          "latest activity summary 없음"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[hsl(var(--muted))]">
                        <span>
                          {session.duration_ms !== null
                            ? formatDuration(session.duration_ms)
                            : "-"}
                        </span>
                        <span>
                          {session.updated_at
                            ? formatTimestamp(session.updated_at)
                            : "updated_at 없음"}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyPanelCopy>비교할 session이 없습니다.</EmptyPanelCopy>
                )}
              </div>
            </SummaryPanel>
          </div>
        </div>
      )}
    </section>
  );
}

function buildFiltersFromDraft(draftFilters: {
  workspace: string;
  sessionId: string;
  fromDate: string;
  toDate: string;
}): SummaryDashboardFilters {
  const nextFilters: SummaryDashboardFilters = {};

  if (draftFilters.workspace) {
    nextFilters.workspace = draftFilters.workspace;
  }
  if (draftFilters.sessionId) {
    nextFilters.session_id = draftFilters.sessionId;
  }
  if (draftFilters.fromDate) {
    nextFilters.from_date = draftFilters.fromDate;
  }
  if (draftFilters.toDate) {
    nextFilters.to_date = draftFilters.toDate;
  }

  return nextFilters;
}

function FilterField({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 text-sm">
      <label
        htmlFor={id}
        className="block text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--muted))]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
        {label}
      </p>
      <p className="mt-3 font-mono text-2xl">{value}</p>
    </article>
  );
}

function SummaryPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyPanelCopy({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[hsl(var(--line))] px-3 py-3 text-sm text-[hsl(var(--muted))]">
      {children}
    </p>
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
