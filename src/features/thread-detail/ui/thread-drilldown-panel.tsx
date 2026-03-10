import { Clock3, FileJson2, MessageSquareText, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import type { ThreadTimelineLane } from "@/features/thread-detail/lib/build-thread-timeline-view-model";
import type { ThreadDrilldown } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type ThreadDrilldownPanelProps = {
  lane: ThreadTimelineLane | null;
  drilldown: ThreadDrilldown | null;
  isLoading: boolean;
};

export function ThreadDrilldownPanel({
  lane,
  drilldown,
  isLoading,
}: ThreadDrilldownPanelProps) {
  const laneId = lane?.id ?? null;
  const [isRawSnippetExpanded, setIsRawSnippetExpanded] = useState(false);

  useEffect(() => {
    if (laneId === null) {
      setIsRawSnippetExpanded(false);
      return;
    }

    setIsRawSnippetExpanded(false);
  }, [laneId]);

  return (
    <aside
      data-testid="thread-drilldown-panel"
      className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            Agent Drilldown
          </p>
          <p className="mt-2 text-sm font-medium">
            {lane?.label ?? "lane 없음"}
          </p>
          <p className="mt-1 text-xs text-[hsl(var(--muted))]">
            {lane?.caption ?? "선택한 lane의 최근 commentary, tool, wait 영향, raw snippet"}
          </p>
        </div>
        {lane ? (
          <span className="rounded-full border border-[hsl(var(--line))] px-3 py-1 text-[11px] text-[hsl(var(--muted))]">
            {lane.kind}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <PanelNotice>선택한 lane drilldown을 불러오는 중입니다.</PanelNotice>
      ) : !drilldown ? (
        <PanelNotice>선택한 lane drilldown을 아직 계산하지 못했습니다.</PanelNotice>
      ) : (
        <div className="mt-4 space-y-4">
          <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.74)] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              <MessageSquareText size={13} />
              Latest Commentary
            </div>
            <p className="mt-2 text-sm leading-6">
              {drilldown.latest_commentary_summary ?? "commentary가 아직 없습니다."}
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              {drilldown.latest_commentary_at
                ? formatTimestamp(drilldown.latest_commentary_at)
                : "timestamp 없음"}
            </p>
          </section>

          <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.74)] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              <Wrench size={13} />
              Recent Tool Spans
            </div>
            {drilldown.recent_tool_spans.length > 0 ? (
              <div className="mt-3 space-y-2">
                {drilldown.recent_tool_spans.map((span) => (
                  <article
                    key={`${span.tool_name}-${span.started_at}`}
                    className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.68)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{span.tool_name}</span>
                      <span className="text-[11px] text-[hsl(var(--muted))]">
                        {renderDuration(span.duration_ms)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                      {formatTimestamp(span.started_at)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyCopy>선택한 lane에서 기록된 tool span이 없습니다.</EmptyCopy>
            )}
          </section>

          <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.74)] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              <Clock3 size={13} />
              Wait Impact
            </div>
            {drilldown.related_wait_spans.length > 0 ? (
              <div className="mt-3 space-y-2">
                {drilldown.related_wait_spans.map((span) => (
                  <article
                    key={`${span.parent_session_id}-${span.child_session_id}-${span.started_at}`}
                    className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.68)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {renderWaitPeerLabel(lane, span.parent_session_id, span.child_session_id)}
                      </span>
                      <span className="text-[11px] text-[hsl(var(--muted))]">
                        {renderDuration(span.duration_ms)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                      {formatTimestamp(span.started_at)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyCopy>선택한 lane과 직접 연결된 wait span이 없습니다.</EmptyCopy>
            )}
          </section>

          <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.74)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
                <FileJson2 size={13} />
                Raw JSONL Snippet
              </div>
              {drilldown.raw_snippet ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsRawSnippetExpanded((current) => !current)}
                >
                  {isRawSnippetExpanded ? "접기" : "원문 보기"}
                </Button>
              ) : null}
            </div>
            {drilldown.raw_snippet ? (
              <>
                <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                  {drilldown.raw_snippet.source_label}
                  {drilldown.raw_snippet.truncated ? " • truncated" : ""}
                </p>
                {isRawSnippetExpanded ? (
                  <pre
                    data-testid="raw-snippet-content"
                    className="mt-3 overflow-x-auto rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg)/0.78)] p-3 text-xs leading-6 text-[hsl(var(--fg))]"
                  >
                    {drilldown.raw_snippet.lines
                      .map((line) => `${String(line.line_number).padStart(4, " ")} ${line.content}`)
                      .join("\n")}
                  </pre>
                ) : (
                  <EmptyCopy>raw snippet은 기본 접힘 상태입니다.</EmptyCopy>
                )}
              </>
            ) : (
              <EmptyCopy>원본 rollout path를 아직 읽을 수 없습니다.</EmptyCopy>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

function PanelNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.68)] p-4 text-sm text-[hsl(var(--muted))]">
      {children}
    </div>
  );
}

function EmptyCopy({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-[hsl(var(--line))] px-3 py-3 text-sm text-[hsl(var(--muted))]">
      {children}
    </p>
  );
}

function renderWaitPeerLabel(
  lane: ThreadTimelineLane | null,
  parentSessionId: string,
  childSessionId: string | null,
) {
  if (lane?.kind === "main") {
    return `child ${childSessionId ?? "unknown"}`;
  }

  return `waited by ${parentSessionId}`;
}

function renderDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "in progress";
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds % 60}s`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}
