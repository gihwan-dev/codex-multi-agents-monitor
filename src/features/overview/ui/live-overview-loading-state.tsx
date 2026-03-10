export function LiveOverviewLoadingState() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-8 text-sm text-[hsl(var(--muted))]">
      <div className="mb-3 h-2 w-24 animate-pulse rounded bg-[hsl(var(--line-strong))]" />
      live thread snapshot loading...
    </div>
  );
}
