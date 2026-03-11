import {
  AlertTriangle,
  AreaChart,
  FolderOpen,
  Gauge,
  Logs,
  Users,
} from "lucide-react";
import { useState } from "react";

import { formatDuration } from "@/features/overview/lib/live-overview-formatters";
import {
  openLogFile,
  openWorkspace,
  type TauriCommandError,
} from "@/shared/lib/tauri/commands";
import type {
  HistoryHealth,
  HistorySourceKey,
  HistorySummaryPayload,
} from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type HistoryShellProps = {
  summary: HistorySummaryPayload | null;
  isLoading: boolean;
};

type ActionKind = "workspace" | "log";

type PendingAction = {
  threadId: string;
  kind: ActionKind;
} | null;

const kpiCardClassName =
  "rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4";
const historyLoadingCardIds = [
  "threads",
  "average-duration",
  "timeouts",
  "spawns",
] as const;
const sourceLabelByKey: Record<HistorySourceKey, string> = {
  live_sessions: "live sessions",
  archived_sessions: "archived sessions",
  state_db: "state db",
};

export function HistoryShell({ summary, isLoading }: HistoryShellProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const healthNotice = summary ? buildHealthNotice(summary.health) : null;

  async function runAction(
    threadId: string,
    kind: ActionKind,
    action: () => Promise<void>,
  ) {
    setActionError(null);
    setPendingAction({ threadId, kind });
    try {
      await action();
    } catch (error) {
      setActionError(formatActionError(error, kind));
    } finally {
      setPendingAction((current) => {
        if (!current) {
          return null;
        }
        return current.threadId === threadId && current.kind === kind
          ? null
          : current;
      });
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">History</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {historyLoadingCardIds.map((loadingCardId) => (
            <div
              key={loadingCardId}
              className="h-28 animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!summary || summary.history.thread_count === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">History</h2>
        {healthNotice ? <HistoryHealthNotice notice={healthNotice} /> : null}
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-sm text-[hsl(var(--muted))]">
          7일 요약 데이터가 아직 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            History
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            최근 {summary.history.from_date} ~ {summary.history.to_date}
          </h2>
        </div>
        {actionError ? (
          <div className="rounded-2xl border border-[hsl(var(--warn)/0.35)] bg-[hsl(var(--warn)/0.12)] px-4 py-3 text-sm text-[hsl(var(--warn))]">
            {actionError}
          </div>
        ) : null}
        {healthNotice ? <HistoryHealthNotice notice={healthNotice} /> : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={kpiCardClassName}>
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <Gauge size={16} />
            threads
          </div>
          <p className="font-mono text-2xl">{summary.history.thread_count}</p>
        </article>

        <article className={kpiCardClassName}>
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <AreaChart size={16} />
            average duration
          </div>
          <p className="font-mono text-2xl">
            {summary.history.average_duration_ms !== null
              ? formatDuration(summary.history.average_duration_ms)
              : "-"}
          </p>
        </article>

        <article className={kpiCardClassName}>
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={16} />
            timeouts
          </div>
          <p className="font-mono text-2xl">{summary.history.timeout_count}</p>
        </article>

        <article className={kpiCardClassName}>
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <Users size={16} />
            spawns
          </div>
          <p className="font-mono text-2xl">{summary.history.spawn_count}</p>
        </article>
      </div>

      <section className="space-y-3">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            Role Breakdown
          </p>
          <h3 className="text-base font-semibold tracking-tight">
            최근 7일 subagent 회고
          </h3>
        </header>

        {summary.roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-6 text-sm text-[hsl(var(--muted))]">
            최근 7일 기준 role breakdown 데이터가 없습니다.
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {summary.roles.map((role) => (
              <li
                key={role.agent_role}
                className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{role.agent_role}</p>
                    <p className="mt-1 text-sm text-[hsl(var(--muted))]">
                      sessions {role.session_count}
                    </p>
                  </div>
                  <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
                    spawn {role.spawn_count}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <MetricBadge
                    label="avg"
                    value={
                      role.average_duration_ms !== null
                        ? formatDuration(role.average_duration_ms)
                        : "-"
                    }
                  />
                  <MetricBadge
                    label="timeouts"
                    value={`${role.timeout_count}`}
                  />
                  <MetricBadge label="spawns" value={`${role.spawn_count}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            Slow Thread Retrospective
          </p>
          <h3 className="text-base font-semibold tracking-tight">
            duration 기준 상위 {summary.slow_threads.length}개 thread
          </h3>
        </header>

        <ul className="space-y-3">
          {summary.slow_threads.map((thread) => {
            const workspacePending =
              pendingAction?.threadId === thread.thread_id &&
              pendingAction.kind === "workspace";
            const logPending =
              pendingAction?.threadId === thread.thread_id &&
              pendingAction.kind === "log";

            return (
              <li
                key={thread.thread_id}
                className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{thread.title}</p>
                      <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[11px] text-[hsl(var(--muted))]">
                        {thread.thread_id}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted))]">
                      {thread.latest_activity_summary ??
                        "최근 activity 요약 없음"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
                    updated {thread.updated_at}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-[hsl(var(--muted))]">
                    workspace {thread.cwd}
                  </span>
                  {thread.agent_roles.length > 0 ? (
                    thread.agent_roles.map((role) => (
                      <span
                        key={`${thread.thread_id}-${role}`}
                        className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-[hsl(var(--muted))]"
                      >
                        role {role}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-[hsl(var(--muted))]">
                      role none
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <MetricBadge
                    label="duration"
                    value={
                      thread.duration_ms !== null
                        ? formatDuration(thread.duration_ms)
                        : "-"
                    }
                  />
                  <MetricBadge
                    label="timeouts"
                    value={`${thread.timeout_count}`}
                  />
                  <MetricBadge label="spawns" value={`${thread.spawn_count}`} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={workspacePending}
                    onClick={() =>
                      runAction(thread.thread_id, "workspace", () =>
                        openWorkspace(thread.cwd),
                      )
                    }
                  >
                    <FolderOpen size={14} />
                    workspace 열기
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={logPending || !thread.rollout_path}
                    onClick={() => {
                      const rolloutPath = thread.rollout_path;
                      if (!rolloutPath) {
                        return;
                      }
                      runAction(thread.thread_id, "log", () =>
                        openLogFile(rolloutPath),
                      );
                    }}
                  >
                    <Logs size={14} />
                    log 열기
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.48)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}

function HistoryHealthNotice({ notice }: { notice: string }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--warn)/0.35)] bg-[hsl(var(--warn)/0.12)] px-4 py-3 text-sm text-[hsl(var(--warn))]">
      {notice}
    </div>
  );
}

function buildHealthNotice(health: HistoryHealth) {
  const messages = [];
  if (health.missing_sources.length > 0) {
    messages.push(
      `누락된 source: ${health.missing_sources.map(formatSourceLabel).join(", ")}`,
    );
  }
  if (health.degraded_sources.length > 0) {
    messages.push(buildDegradedSourceNotice(health.degraded_sources));
  }
  if (health.degraded_rollout_threads > 0) {
    messages.push(
      `${health.degraded_rollout_threads}개 thread는 rollout parsing이 불완전해 timeout/spawn 수치가 과소 집계될 수 있습니다.`,
    );
  }

  return messages.length > 0 ? messages.join(" ") : null;
}

function formatSourceLabel(source: HistorySourceKey) {
  return sourceLabelByKey[source];
}

function buildDegradedSourceNotice(sources: HistorySourceKey[]) {
  if (
    sources.length === 1 &&
    sources[0] === "state_db"
  ) {
    return "state db를 읽지 못해 archived thread 메타데이터 보강이 일부 비활성화되었습니다.";
  }

  return `읽지 못한 source: ${sources.map(formatSourceLabel).join(", ")}`;
}

function formatActionError(error: unknown, kind: ActionKind) {
  const fallback =
    kind === "workspace"
      ? "workspace를 열지 못했습니다."
      : "log 파일을 열지 못했습니다.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const maybeError = error as Partial<TauriCommandError>;
  if (typeof maybeError.message === "string" && maybeError.message.length > 0) {
    return maybeError.message;
  }

  return fallback;
}
