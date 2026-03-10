type ThreadTimelineHeaderProps = {
  title: string;
  status: string;
};

export function ThreadTimelineHeader({
  title,
  status,
}: ThreadTimelineHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Thread Detail
        </p>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-xs text-[hsl(var(--muted))]">
        {status}
      </span>
    </header>
  );
}
