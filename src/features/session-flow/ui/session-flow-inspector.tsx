import { useState } from "react";
import { getSessionLaneKey } from "@/features/session-flow/lib/build-session-flow-view-model";
import type {
  RawJsonlSnippet,
  SessionFlowPayload,
  SessionLaneInspectorPayload,
} from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type SessionFlowInspectorProps = {
  flow: SessionFlowPayload | null;
  selectedItemId: string | null;
  inspector: SessionLaneInspectorPayload | null;
  isDrilldownLoading: boolean;
};

export function SessionFlowInspector({
  flow,
  selectedItemId,
  inspector,
  isDrilldownLoading,
}: SessionFlowInspectorProps) {
  const selectedItem =
    flow?.items.find((item) => item.item_id === selectedItemId) ??
    flow?.items[flow.items.length - 1] ??
    null;
  const lane = selectedItem
    ? (flow?.lanes.find(
        (candidate) =>
          getSessionLaneKey(candidate.lane_ref) ===
          getSessionLaneKey(selectedItem.lane),
      ) ?? null)
    : null;

  if (!flow) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
        session flow data가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
        Inspector
      </p>
      <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.56)] p-4">
        <h3 className="text-base font-semibold">{flow.session.title}</h3>
        <p className="mt-1 text-sm text-[hsl(var(--muted))]">
          {flow.session.latest_activity_summary ??
            "latest activity summary 없음"}
        </p>
      </div>
      {selectedItem ? (
        <div className="space-y-3">
          <dl className="grid gap-2 text-sm">
            <InspectorCard label="kind" value={selectedItem.kind} />
            <InspectorCard
              label="lane"
              value={lane?.label ?? renderLaneRef(selectedItem.lane)}
            />
            <InspectorCard label="started" value={selectedItem.started_at} />
            <InspectorCard
              label="ended"
              value={selectedItem.ended_at ?? "open"}
            />
            <InspectorCard
              label="summary"
              value={selectedItem.summary ?? "-"}
            />
            <InspectorCard
              label="target"
              value={
                selectedItem.target_lane
                  ? renderLaneRef(selectedItem.target_lane)
                  : "-"
              }
            />
          </dl>

          <CommentaryPanel
            isDrilldownLoading={isDrilldownLoading}
            latestCommentarySummary={
              inspector?.latest_commentary_summary ?? null
            }
          />
          <RawSnippetPanel
            key={lane ? getSessionLaneKey(lane.lane_ref) : "lane-none"}
            rawSnippet={inspector?.raw_snippet ?? null}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] p-4 text-sm text-[hsl(var(--muted))]">
          item을 선택하면 inspector가 열린다.
        </div>
      )}
    </div>
  );
}

function InspectorCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--line))] px-3 py-2">
      <dt className="text-[hsl(var(--muted))]">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

function CommentaryPanel({
  isDrilldownLoading,
  latestCommentarySummary,
}: {
  isDrilldownLoading: boolean;
  latestCommentarySummary: string | null;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.56)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
        Latest lane commentary
      </p>
      <p className="mt-2 text-sm leading-6">
        {isDrilldownLoading
          ? "lane commentary를 불러오는 중입니다."
          : (latestCommentarySummary ?? "commentary가 없습니다.")}
      </p>
    </div>
  );
}

function RawSnippetPanel({
  rawSnippet,
}: {
  rawSnippet: RawJsonlSnippet | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.56)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Raw snippet
        </p>
        {rawSnippet ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "접기" : "원문 보기"}
          </Button>
        ) : null}
      </div>
      {rawSnippet ? (
        <>
          <p className="mt-2 text-xs text-[hsl(var(--muted))]">
            {rawSnippet.source_label}
            {rawSnippet.truncated ? " • truncated" : ""}
          </p>
          {isExpanded ? (
            <pre
              data-testid="session-flow-raw-snippet"
              className="mt-3 overflow-x-auto rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg)/0.78)] p-3 text-xs leading-6 text-[hsl(var(--fg))]"
            >
              {rawSnippet.lines
                .map(
                  (line) =>
                    `${String(line.line_number).padStart(4, " ")} ${line.content}`,
                )
                .join("\n")}
            </pre>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[hsl(var(--line))] px-3 py-3 text-sm text-[hsl(var(--muted))]">
              raw snippet은 기본 접힘 상태입니다.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-[hsl(var(--line))] px-3 py-3 text-sm text-[hsl(var(--muted))]">
          원본 rollout path를 아직 읽을 수 없습니다.
        </p>
      )}
    </div>
  );
}

function renderLaneRef(
  laneRef: SessionFlowPayload["lanes"][number]["lane_ref"],
) {
  switch (laneRef.kind) {
    case "user":
      return "user";
    case "main":
      return laneRef.session_id;
    case "subagent":
      return laneRef.agent_session_id;
  }
}
