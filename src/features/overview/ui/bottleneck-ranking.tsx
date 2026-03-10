import {
  renderPrimaryBottleneck,
  severityPillClassMap,
} from "@/features/overview/lib/live-overview-formatters";
import { cn } from "@/shared/lib/utils";
import type { LiveOverviewThread } from "@/shared/types/contracts";

type BottleneckRankingProps = {
  threads: LiveOverviewThread[];
};

export function BottleneckRanking({ threads }: BottleneckRankingProps) {
  return (
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
          top {threads.length}
        </span>
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted))]">
          현재 필터에서 표시할 병목 thread가 없습니다.
        </p>
      ) : (
        <ol aria-label="Bottleneck ranking" className="space-y-2">
          {threads.map((thread, index) => (
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
  );
}
