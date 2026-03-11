import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { getSessionLaneKey } from "@/features/session-flow/lib/build-session-flow-view-model";
import { SessionFlowDiagram } from "@/features/session-flow/ui/session-flow-diagram";
import { SessionFlowInspector } from "@/features/session-flow/ui/session-flow-inspector";
import {
  getSessionFlow,
  getSessionLaneInspector,
} from "@/shared/lib/tauri/commands";

type SessionFlowWorkspaceProps = {
  sessionId: string;
};

export function SessionFlowWorkspace({ sessionId }: SessionFlowWorkspaceProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const flowQuery = useQuery({
    queryKey: ["monitor", "session_flow", sessionId],
    queryFn: () => getSessionFlow(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (query) =>
      query.state.data && !query.state.data.session.archived ? 2_000 : false,
  });
  const flow = flowQuery.data ?? null;

  useEffect(() => {
    if (!flow) {
      setSelectedItemId(null);
      return;
    }

    if (
      selectedItemId &&
      flow.items.some((item) => item.item_id === selectedItemId)
    ) {
      return;
    }

    setSelectedItemId(flow.items[flow.items.length - 1]?.item_id ?? null);
  }, [flow, selectedItemId]);

  const selectedItem = useMemo(
    () => flow?.items.find((item) => item.item_id === selectedItemId) ?? null,
    [flow, selectedItemId],
  );
  const selectedLaneRef =
    selectedItem?.lane ??
    flow?.lanes.find((lane) => lane.column === "main")?.lane_ref ??
    null;
  const inspectorQuery = useQuery({
    queryKey: [
      "monitor",
      "session_lane_inspector",
      sessionId,
      selectedLaneRef ? getSessionLaneKey(selectedLaneRef) : null,
    ],
    queryFn: () =>
      selectedLaneRef
        ? getSessionLaneInspector(sessionId, selectedLaneRef)
        : Promise.resolve(null),
    enabled: Boolean(sessionId && selectedLaneRef),
    refetchInterval: flow && !flow.session.archived ? 2_000 : false,
  });

  if (flowQuery.isLoading) {
    return (
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <div className="h-[420px] animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]" />
        <div className="h-[420px] animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]" />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
        session flow data를 아직 읽지 못했습니다.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.68)] p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            Session workspace
          </p>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{flow.session.title}</h3>
            <p className="text-sm text-[hsl(var(--muted))]">
              {flow.session.latest_activity_summary ??
                "latest activity summary 없음"}
            </p>
          </div>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <MetaCard
            label="workspace"
            value={flow.session.workspace}
            secondary={flow.session.workspace_hint ? `cwd ${flow.session.workspace_hint}` : null}
          />
          <MetaCard label="status" value={flow.session.status} />
          <MetaCard label="lanes" value={`${flow.lanes.length}`} />
        </dl>
      </header>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <SessionFlowDiagram
          flow={flow}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        />
        <SessionFlowInspector
          flow={flow}
          selectedItemId={selectedItemId}
          inspector={inspectorQuery.data ?? null}
          isDrilldownLoading={inspectorQuery.isLoading}
        />
      </div>
    </section>
  );
}

function MetaCard({
  label,
  value,
  secondary = null,
}: {
  label: string;
  value: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.72)] px-3 py-2">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
        {label}
      </dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
      {secondary ? (
        <dd className="mt-1 break-all text-xs text-[hsl(var(--muted))]">
          {secondary}
        </dd>
      ) : null}
    </div>
  );
}
