import { Hourglass, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import type { MonitorThread } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type LiveOverviewShellProps = {
  threads: MonitorThread[];
  isLoading: boolean;
};

export function LiveOverviewShell({
  threads,
  isLoading,
}: LiveOverviewShellProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Live Overview
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Inflight thread timeline shell
        </h2>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-8 text-sm text-[hsl(var(--muted))]">
          <div className="mb-3 h-2 w-24 animate-pulse rounded bg-[hsl(var(--line-strong))]" />
          live thread snapshot loading...
        </div>
      ) : null}

      {!isLoading && threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center">
          <SearchX className="mx-auto mb-3 text-[hsl(var(--muted))]" />
          <p className="text-sm text-[hsl(var(--muted))]">
            inflight thread가 없습니다. `~/.codex/sessions`가 비어 있어도 앱은
            정상입니다.
          </p>
          <div className="mt-4">
            <Link to="/history">
              <Button variant="ghost" size="sm">
                최근 히스토리 보기
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && threads.length > 0 ? (
        <ul className="space-y-3">
          {threads.map((thread) => (
            <li
              key={thread.thread_id}
              className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium">{thread.title}</p>
                <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--warn))]">
                  <Hourglass size={14} />
                  {thread.status}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[hsl(var(--line))]">
                <div className="h-2 w-1/3 rounded-full bg-[hsl(var(--accent-strong))]" />
              </div>
              <div className="mt-3">
                <Link to={`/threads/${thread.thread_id}`}>
                  <Button size="sm" variant="ghost">
                    thread detail 열기
                  </Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
