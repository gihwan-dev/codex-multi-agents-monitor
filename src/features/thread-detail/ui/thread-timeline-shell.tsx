import { Activity, Clock3 } from "lucide-react";

import type { ThreadDetail } from "@/shared/types/contracts";

type ThreadTimelineShellProps = {
  threadId: string;
  detail: ThreadDetail | null;
  isLoading: boolean;
};

export function ThreadTimelineShell({
  threadId,
  detail,
  isLoading,
}: ThreadTimelineShellProps) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Thread Detail</h2>
        <div className="h-28 animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]" />
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Thread Detail</h2>
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.6)] p-8 text-sm text-[hsl(var(--muted))]">
          thread_id=<span className="font-mono">{threadId}</span> 데이터가 아직
          없습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            Thread Detail
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            {detail.thread.title}
          </h2>
        </div>
        <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
          {detail.thread.status}
        </span>
      </header>

      <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Activity size={16} />
          Swimlane skeleton
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-[hsl(var(--line))] p-3">
            <p className="mb-2 text-xs text-[hsl(var(--muted))]">
              main thread lane
            </p>
            <div className="h-2 rounded-full bg-[hsl(var(--line))]">
              <div className="h-2 w-2/5 rounded-full bg-[hsl(var(--accent-strong))]" />
            </div>
          </div>
          <div className="rounded-xl border border-[hsl(var(--line))] p-3">
            <p className="mb-2 text-xs text-[hsl(var(--muted))]">
              subagent lane
            </p>
            <div className="h-2 rounded-full bg-[hsl(var(--line))]">
              <div className="h-2 w-1/4 rounded-full bg-[hsl(var(--ok))]" />
            </div>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
          <Clock3 size={13} />
          wait-to-child 연결선은 후속 slice에서 구현
        </div>
      </div>
    </section>
  );
}
