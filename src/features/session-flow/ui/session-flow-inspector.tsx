import type { SessionFlowPayload } from "@/shared/types/contracts";

type SessionFlowInspectorProps = {
  flow: SessionFlowPayload | null;
  selectedItemId: string | null;
};

export function SessionFlowInspector({
  flow,
  selectedItemId,
}: SessionFlowInspectorProps) {
  if (!flow) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
        session flow data가 없습니다.
      </div>
    );
  }

  const selectedItem =
    flow.items.find((item) => item.item_id === selectedItemId) ??
    flow.items[flow.items.length - 1] ??
    null;
  const lane = selectedItem
    ? flow.lanes.find((candidate) => candidate.lane_id === selectedItem.lane_id)
    : null;

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
        Inspector
      </p>
      <div className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.56)] p-4">
        <h3 className="text-base font-semibold">{flow.session.title}</h3>
        <p className="mt-1 text-sm text-[hsl(var(--muted))]">
          {flow.session.latest_activity_summary ?? "latest activity summary 없음"}
        </p>
      </div>
      {selectedItem ? (
        <dl className="grid gap-2 text-sm">
          <InspectorCard label="kind" value={selectedItem.kind} />
          <InspectorCard label="lane" value={lane?.label ?? selectedItem.lane_id} />
          <InspectorCard label="started" value={selectedItem.started_at} />
          <InspectorCard label="ended" value={selectedItem.ended_at ?? "open"} />
          <InspectorCard label="summary" value={selectedItem.summary ?? "-"} />
          <InspectorCard
            label="target"
            value={selectedItem.target_lane_id ?? "-"}
          />
        </dl>
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
