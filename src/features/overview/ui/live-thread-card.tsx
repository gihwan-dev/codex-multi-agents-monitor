import { Clock3, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

import {
  formatDuration,
  severityPillClassMap,
} from "@/features/overview/lib/live-overview-formatters";
import { MiniTimeline } from "@/features/overview/ui/mini-timeline";
import { cn } from "@/shared/lib/utils";
import type { LiveOverviewThread } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type LiveThreadCardProps = {
  thread: LiveOverviewThread;
};

export function LiveThreadCard({ thread }: LiveThreadCardProps) {
  return (
    <li
      data-testid={`live-thread-${thread.thread_id}`}
      className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{thread.title}</p>
          <p className="mt-1 truncate text-sm text-[hsl(var(--muted))]">
            {thread.latest_activity_summary ?? "최근 activity 요약 없음"}
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
        {thread.active_tool_name && thread.active_tool_ms !== null ? (
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
  );
}
