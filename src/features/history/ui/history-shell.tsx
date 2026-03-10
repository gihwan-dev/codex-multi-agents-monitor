import { AlertTriangle, AreaChart } from "lucide-react";

import type { HistorySummaryPayload } from "@/shared/types/contracts";

type HistoryShellProps = {
  summary: HistorySummaryPayload | null;
  isLoading: boolean;
};

export function HistoryShell({ summary, isLoading }: HistoryShellProps) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">History</h2>
        <div className="h-24 animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">History</h2>
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-sm text-[hsl(var(--muted))]">
          7일 요약 데이터가 아직 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          History
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          최근 {summary.history.from_date} ~ {summary.history.to_date}
        </h2>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <AreaChart size={16} />
            평균 duration
          </div>
          <p className="font-mono text-lg">
            {summary.history.average_duration_ms ?? 0} ms
          </p>
        </article>

        <article className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={16} />
            timeout / spawn
          </div>
          <p className="font-mono text-lg">
            {summary.history.timeout_count} / {summary.history.spawn_count}
          </p>
        </article>
      </div>
    </section>
  );
}
