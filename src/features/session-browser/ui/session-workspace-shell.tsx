import type { ReactNode } from "react";

type SessionWorkspaceShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  sidebar: ReactNode;
  listPane: ReactNode;
  detailPane: ReactNode;
};

export function SessionWorkspaceShell({
  eyebrow,
  title,
  description,
  sidebar,
  listPane,
  detailPane,
}: SessionWorkspaceShellProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          {eyebrow}
        </p>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="max-w-3xl text-sm text-[hsl(var(--muted))]">
            {description}
          </p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,340px)_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.88)] p-4">
          {sidebar}
        </aside>
        <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.72)] p-4">
          {listPane}
        </div>
        <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.56)] p-4">
          {detailPane}
        </div>
      </div>
    </section>
  );
}
