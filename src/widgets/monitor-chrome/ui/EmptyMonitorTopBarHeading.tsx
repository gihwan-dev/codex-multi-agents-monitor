export function EmptyMonitorTopBarHeading() {
  return (
    <div className="grid min-w-0 gap-1.5">
      <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">Graph-first run workbench</p>
      <p className="truncate text-[0.82rem] text-muted-foreground">Ready to inspect</p>
      <div className="grid gap-1">
        <h1 className="min-w-0 truncate text-[clamp(1.18rem,2vw,1.5rem)] font-semibold">Select a run</h1>
        <p className="text-[0.82rem] text-muted-foreground">Select a recent or archived run to inspect.</p>
      </div>
    </div>
  );
}
