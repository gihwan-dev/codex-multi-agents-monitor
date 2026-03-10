import { Activity, Clock3 } from "lucide-react";

export function ThreadSwimlanePanel() {
  return (
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
          <p className="mb-2 text-xs text-[hsl(var(--muted))]">subagent lane</p>
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
  );
}
