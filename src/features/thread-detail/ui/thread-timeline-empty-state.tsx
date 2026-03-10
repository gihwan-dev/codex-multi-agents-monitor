type ThreadTimelineEmptyStateProps = {
  threadId: string;
};

export function ThreadTimelineEmptyState({
  threadId,
}: ThreadTimelineEmptyStateProps) {
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
