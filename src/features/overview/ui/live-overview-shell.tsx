import { Clock3, SearchX, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import type {
  BottleneckLevel,
  LiveOverviewThread,
  MiniTimelineItem,
} from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type LiveOverviewShellProps = {
  threads: LiveOverviewThread[];
  isLoading: boolean;
};

const severityPillClassMap: Record<BottleneckLevel, string> = {
  normal:
    "border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.82)] text-[hsl(var(--muted))]",
  warning:
    "border-[hsl(var(--warn)/0.45)] bg-[hsl(var(--warn)/0.12)] text-[hsl(var(--warn))]",
  critical: "border-rose-500/45 bg-rose-500/12 text-rose-200",
};

const timelineSegmentClassMap: Record<MiniTimelineItem["kind"], string> = {
  wait: "bg-amber-400/85",
  tool: "bg-cyan-400/80",
  message: "bg-slate-200/80",
  spawn: "bg-emerald-400/85",
  complete: "bg-rose-300/85",
};

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${totalSeconds}s`;
  }

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function severityRank(level: BottleneckLevel) {
  switch (level) {
    case "critical":
      return 2;
    case "warning":
      return 1;
    default:
      return 0;
  }
}

function compareBottleneckThreads(
  left: LiveOverviewThread,
  right: LiveOverviewThread,
) {
  return (
    severityRank(right.bottleneck_level) -
      severityRank(left.bottleneck_level) ||
    (right.longest_wait_ms ?? -1) - (left.longest_wait_ms ?? -1) ||
    (right.active_tool_ms ?? -1) - (left.active_tool_ms ?? -1) ||
    new Date(right.updated_at ?? 0).getTime() -
      new Date(left.updated_at ?? 0).getTime()
  );
}

function renderPrimaryBottleneck(thread: LiveOverviewThread) {
  if (thread.longest_wait_ms !== null) {
    return `wait ${formatDuration(thread.longest_wait_ms)}`;
  }

  if (thread.active_tool_name && thread.active_tool_ms !== null) {
    return `tool ${thread.active_tool_name} ${formatDuration(thread.active_tool_ms)}`;
  }

  return "active wait/tool 없음";
}

function MiniTimeline({
  items,
  timelineId,
  windowStartedAt,
  windowEndedAt,
}: {
  items: MiniTimelineItem[];
  timelineId: string;
  windowStartedAt: string;
  windowEndedAt: string;
}) {
  const windowStart = new Date(windowStartedAt).getTime();
  const windowEnd = new Date(windowEndedAt).getTime();
  const windowDuration = Math.max(windowEnd - windowStart, 1);

  return (
    <div
      aria-label="Mini timeline"
      role="img"
      data-testid={timelineId}
      className="relative h-10 rounded-xl border border-[hsl(var(--line))] bg-[linear-gradient(90deg,hsl(var(--panel)/0.86),hsl(var(--panel-2)/0.9))]"
    >
      <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-5 gap-0 border-x border-[hsl(var(--line)/0.35)]">
        {["20", "40", "60", "80"].map((gridOffset) => (
          <span
            key={gridOffset}
            className="border-r border-[hsl(var(--line)/0.35)]"
          />
        ))}
      </div>
      {items.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[hsl(var(--muted))]">
          최근 10분 activity 없음
        </div>
      ) : null}
      {items.map((item) => {
        const startedAt = new Date(item.started_at).getTime();
        const endedAt = new Date(item.ended_at ?? item.started_at).getTime();
        const clampedStart = Math.max(startedAt, windowStart);
        const clampedEnd = Math.min(Math.max(endedAt, clampedStart), windowEnd);
        const left = ((clampedStart - windowStart) / windowDuration) * 100;
        const width =
          Math.max(((clampedEnd - clampedStart) / windowDuration) * 100, 1.6) ||
          1.6;

        return (
          <span
            key={`${item.kind}-${item.started_at}-${item.ended_at ?? "open"}`}
            data-testid={`${timelineId}-${item.kind}-${item.started_at}`}
            className={cn(
              "absolute top-1/2 h-3 -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(15,23,42,0.2)]",
              timelineSegmentClassMap[item.kind],
            )}
            style={{
              left: `${left}%`,
              width: `${width}%`,
            }}
          />
        );
      })}
    </div>
  );
}

export function LiveOverviewShell({
  threads,
  isLoading,
}: LiveOverviewShellProps) {
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const workspaceOptions = Array.from(
    new Set(threads.map((thread) => thread.cwd)),
  ).sort();
  const roleOptions = Array.from(
    new Set(threads.flatMap((thread) => thread.agent_roles)),
  ).sort();

  const filteredThreads = threads.filter((thread) => {
    if (workspaceFilter !== "all" && thread.cwd !== workspaceFilter) {
      return false;
    }

    if (roleFilter !== "all" && !thread.agent_roles.includes(roleFilter)) {
      return false;
    }

    if (
      severityFilter !== "all" &&
      thread.bottleneck_level !== severityFilter
    ) {
      return false;
    }

    return true;
  });
  const bottleneckThreads = [...filteredThreads]
    .sort(compareBottleneckThreads)
    .slice(0, 5);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Live Overview
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Inflight thread timeline shell
        </h2>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-8 text-sm text-[hsl(var(--muted))]">
          <div className="mb-3 h-2 w-24 animate-pulse rounded bg-[hsl(var(--line-strong))]" />
          live thread snapshot loading...
        </div>
      ) : null}

      {!isLoading && threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center">
          <SearchX className="mx-auto mb-3 text-[hsl(var(--muted))]" />
          <p className="text-sm text-[hsl(var(--muted))]">
            inflight thread가 없습니다. `~/.codex/sessions`가 비어 있어도 앱은
            정상입니다.
          </p>
          <div className="mt-4">
            <Link to="/history">
              <Button variant="ghost" size="sm">
                최근 히스토리 보기
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && threads.length > 0 ? (
        <>
          <section className="grid gap-3 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="block text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Workspace
              </span>
              <select
                aria-label="Workspace filter"
                className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm text-[hsl(var(--fg))] outline-none"
                value={workspaceFilter}
                onChange={(event) => setWorkspaceFilter(event.target.value)}
              >
                <option value="all">all workspaces</option>
                {workspaceOptions.map((workspace) => (
                  <option key={workspace} value={workspace}>
                    {workspace}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Role
              </span>
              <select
                aria-label="Role filter"
                className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm text-[hsl(var(--fg))] outline-none"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">all roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Status
              </span>
              <select
                aria-label="Status filter"
                className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm text-[hsl(var(--fg))] outline-none"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option value="all">all severities</option>
                <option value="normal">normal</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                  Bottleneck ranking
                </p>
                <p className="text-sm text-[hsl(var(--muted))]">
                  severity desc - longest wait - active tool - updated_at
                </p>
              </div>
              <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
                top {bottleneckThreads.length}
              </span>
            </div>

            {bottleneckThreads.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted))]">
                현재 필터에서 표시할 병목 thread가 없습니다.
              </p>
            ) : (
              <ol aria-label="Bottleneck ranking" className="space-y-2">
                {bottleneckThreads.map((thread, index) => (
                  <li
                    key={`bottleneck-${thread.thread_id}`}
                    data-testid={`bottleneck-${thread.thread_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.74)] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {index + 1}. {thread.title}
                      </p>
                      <p className="truncate text-xs text-[hsl(var(--muted))]">
                        {renderPrimaryBottleneck(thread)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        severityPillClassMap[thread.bottleneck_level],
                      )}
                    >
                      {thread.bottleneck_level}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {filteredThreads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center text-sm text-[hsl(var(--muted))]">
              현재 필터와 일치하는 inflight thread가 없습니다.
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredThreads.map((thread) => (
                <li
                  key={thread.thread_id}
                  data-testid={`live-thread-${thread.thread_id}`}
                  className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{thread.title}</p>
                      <p className="mt-1 truncate text-sm text-[hsl(var(--muted))]">
                        {thread.latest_activity_summary ??
                          "최근 activity 요약 없음"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        severityPillClassMap[thread.bottleneck_level],
                      )}
                    >
                      {thread.bottleneck_level}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-[hsl(var(--muted))]">
                      workspace {thread.cwd}
                    </span>
                    <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-[hsl(var(--muted))]">
                      roles{" "}
                      {thread.agent_roles.length > 0
                        ? thread.agent_roles.join(", ")
                        : "none"}
                    </span>
                    {thread.longest_wait_ms !== null ? (
                      <span className="rounded-full border border-[hsl(var(--warn)/0.4)] px-3 py-1 text-[hsl(var(--warn))]">
                        wait {formatDuration(thread.longest_wait_ms)}
                      </span>
                    ) : null}
                    {thread.active_tool_name &&
                    thread.active_tool_ms !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--line-strong))] px-3 py-1 text-[hsl(var(--fg))]">
                        <Wrench size={12} />
                        tool {thread.active_tool_name}{" "}
                        {formatDuration(thread.active_tool_ms)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs text-[hsl(var(--muted))]">
                      <span>mini timeline</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        rolling 10m
                      </span>
                    </div>
                    <MiniTimeline
                      items={thread.mini_timeline}
                      timelineId={`mini-timeline-${thread.thread_id}`}
                      windowStartedAt={thread.mini_timeline_window_started_at}
                      windowEndedAt={thread.mini_timeline_window_ended_at}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-[hsl(var(--muted))]">
                      thread_id {thread.thread_id}
                    </span>
                    <Link to={`/threads/${thread.thread_id}`}>
                      <Button size="sm" variant="ghost">
                        detail 열기
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
