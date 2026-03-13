import { GlassSurface } from "@/app/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimestamp, type SessionSummary } from "@/entities/session";
import type { CanonicalMetric } from "@/shared/canonical";
import { Binary, Braces, Boxes, DatabaseZap, Link2 } from "lucide-react";

import type {
  TimelineItemView,
  TimelineProjection,
  TimelineSelection,
  TimelineSelectionContext,
} from "../model/types";

interface DetailDrawerProps {
  errorMessage?: string | null;
  loading?: boolean;
  onSelectionChange: (selection: TimelineSelection) => void;
  projection: TimelineProjection | null;
  selectedSession: SessionSummary | null;
  selection: TimelineSelection;
  selectionContext: TimelineSelectionContext | null;
}

const PANEL_CARD_CLASS =
  "gap-0 flex h-full flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none ring-0";
const DETAIL_TAB_TRIGGER_CLASS =
  "rounded-[0.85rem] px-3 text-[12px] font-medium tracking-[0.01em] text-slate-300/70 transition-[background-color,color,box-shadow] duration-200 data-[active]:border-white/8 data-[active]:bg-white/[0.1] data-[active]:text-white focus-visible:border-white/18 focus-visible:bg-white/[0.14] focus-visible:text-white focus-visible:ring-[3px] focus-visible:ring-sky-200/26 focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_24px_rgba(125,211,252,0.16)] focus-visible:outline-none";

function describeStatus(status: SessionSummary["status"] | undefined) {
  switch (status) {
    case "live":
      return "Streaming live updates.";
    case "completed":
      return "Capture complete.";
    case "stalled":
      return "Runtime paused. Latest summary remains visible.";
    case "archived":
      return "Replay snapshot available.";
    case "aborted":
      return "The session stopped before the normal completion path.";
    default:
      return "Select a session to inspect recent events.";
  }
}

function formatDuration(startedAtMs: number, endedAtMs: number | null) {
  if (!endedAtMs || endedAtMs <= startedAtMs) {
    return "Point-in-time event";
  }

  const durationMs = endedAtMs - startedAtMs;
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

function laneLabel(projection: TimelineProjection | null, laneId: string | null | undefined) {
  if (!projection || !laneId) {
    return "Unknown";
  }

  return projection.lanes.find((lane) => lane.laneId === laneId)?.label ?? laneId;
}

function connectorLabel(kind: NonNullable<TimelineSelectionContext["selectedConnector"]>["kind"]) {
  switch (kind) {
    case "spawn":
      return "Spawn";
    case "handoff":
      return "Handoff";
    case "reply":
      return "Reply";
    default:
      return "Complete";
  }
}

function metricCard(metric: CanonicalMetric) {
  return (
    <section
      key={metric.metric_id}
      className="rounded-[1.4rem] border border-white/5 bg-white/[0.024] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <p className="text-[11px] font-medium text-slate-500 capitalize">
        {metric.name.split("_").join(" ")}
      </p>
      <p className="mt-2 text-xl text-white">{String(metric.value)}</p>
      <p className="mt-1 text-xs text-slate-400">{metric.unit ?? "unitless"}</p>
    </section>
  );
}

function tokenSummary(projection: TimelineProjection | null, selectedItem: TimelineItemView | null) {
  if (!projection) {
    return {
      input: 0,
      label: "No session selected",
      output: 0,
    };
  }

  if (selectedItem) {
    return {
      input: selectedItem.tokenInput,
      label: `${selectedItem.label} token footprint`,
      output: selectedItem.tokenOutput,
    };
  }

  return {
    input: projection.sessionTokenTotals.input,
    label: "Session token totals",
    output: projection.sessionTokenTotals.output,
  };
}

function selectionDescription(
  projection: TimelineProjection | null,
  selectedSession: SessionSummary | null,
  selectionContext: TimelineSelectionContext | null,
) {
  if (selectionContext?.selectedConnector) {
    return `${connectorLabel(selectionContext.selectedConnector.kind)} connector from ${laneLabel(
      projection,
      selectionContext.selectedConnector.sourceLaneId,
    )} to ${laneLabel(projection, selectionContext.selectedConnector.targetLaneId)}.`;
  }

  if (selectionContext?.selectedSegment) {
    return `${laneLabel(projection, selectionContext.selectedSegment.laneId)} activation segment.`;
  }

  if (selectionContext?.selectedItem) {
    return `${selectionContext.selectedItem.kind} selection in ${laneLabel(
      projection,
      selectionContext.selectedItem.laneId,
    )}.`;
  }

  return describeStatus(selectedSession?.status);
}

function selectionChain(projection: TimelineProjection | null, selectionContext: TimelineSelectionContext | null) {
  if (!projection || !selectionContext || selectionContext.anchorItemId == null) {
    return null;
  }

  const connector = selectionContext.selectedConnector;
  const segment = selectionContext.selectedSegment;
  const turn = selectionContext.selectedTurnBand;
  const anchorItem = selectionContext.selectedItem;

  return {
    connector: connector ? connectorLabel(connector.kind) : segment ? "Segment scope" : "Item scope",
    flow: connector
      ? `${laneLabel(projection, connector.sourceLaneId)} -> ${laneLabel(projection, connector.targetLaneId)}`
      : `${laneLabel(projection, anchorItem?.laneId ?? segment?.laneId)} activation`,
    relatedCount: selectionContext.relatedItemIds.length,
    turn:
      turn == null
        ? "Session scope"
        : turn.summary
          ? `${turn.label} · ${turn.summary}`
          : turn.label,
  };
}

export function DetailDrawer({
  errorMessage = null,
  loading = false,
  onSelectionChange,
  projection,
  selectedSession,
  selection,
  selectionContext,
}: DetailDrawerProps) {
  const selectedItem = selectionContext?.selectedItem ?? null;
  const selectedSegment = selectionContext?.selectedSegment ?? null;
  const selectedConnector = selectionContext?.selectedConnector ?? null;
  const sessionTitle =
    selectedItem?.label ??
    (selectedConnector ? connectorLabel(selectedConnector.kind) : null) ??
    (selectedSegment ? `${laneLabel(projection, selectedSegment.laneId)} activation` : null) ??
    selectedSession?.title ??
    projection?.session.title ??
    "Event detail";
  const metrics = projection?.metrics ?? [];
  const latestItem = projection?.items[projection.items.length - 1] ?? null;
  const summaryBody = selectedItem
    ? selectedItem.summary ?? selectedItem.payloadPreview ?? "No item summary available."
    : latestItem?.summary ?? "Latest summary will appear here once a session is selected.";
  const tokenState = tokenSummary(projection, selectedItem);
  const rawPayload = selectedItem
    ? JSON.stringify(
        {
          item: {
            ended_at: selectedItem.endedAt,
            item_id: selectedItem.itemId,
            kind: selectedItem.kind,
            lane_id: selectedItem.laneId,
            meta: selectedItem.meta,
            started_at: selectedItem.startedAt,
          },
          source_events: selectedItem.sourceEvents,
        },
        null,
        2,
      )
    : JSON.stringify(
        {
          latest_item: latestItem,
          session: projection?.session ?? null,
        },
        null,
        2,
      );
  const chain = selectionChain(projection, selectionContext);

  return (
    <GlassSurface
      refraction="none"
      variant="panel"
      className="panel-subtle flex h-full min-h-[520px] flex-col overflow-hidden"
    >
      <div className="h-full" data-testid="timeline-detail-drawer">
        <Card className={PANEL_CARD_CLASS}>
          <CardHeader className="bg-transparent px-5 pb-3.5 pt-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-[30rem]">
                <p className="mb-2 text-[11px] font-medium text-slate-400">Detail drawer</p>
                <CardTitle className="max-w-[24ch] text-[1.4rem] font-normal leading-[1.04] tracking-[-0.03em] text-white break-words">
                  {sessionTitle}
                </CardTitle>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300/64">
                  {errorMessage
                    ? errorMessage
                    : loading
                      ? "Hydrating session detail."
                      : selectionDescription(projection, selectedSession, selectionContext)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:max-w-[12rem] xl:justify-end">
                {selection.kind !== "session" ? (
                  <GlassSurface
                    className="rounded-full"
                    interactive
                    refraction="soft"
                    variant="control"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-[inherit] border-0 bg-transparent px-3 text-[11px] font-medium text-slate-100 hover:bg-transparent hover:text-white"
                      onClick={() => onSelectionChange({ kind: "session" })}
                    >
                      Session summary
                    </Button>
                  </GlassSurface>
                ) : null}
                <GlassSurface
                  className="rounded-full"
                  interactive
                  refraction="soft"
                  variant="control"
                >
                  <div className="px-2.5 py-1.5">
                    <span className="text-[11px] font-medium tracking-[0.01em] text-slate-100 capitalize">
                      {selectedConnector
                        ? selectedConnector.kind
                        : selectedSegment
                          ? "segment"
                          : selectedItem
                            ? selectedItem.kind
                            : selectedSession?.status ?? "idle"}
                    </span>
                  </div>
                </GlassSurface>
                <p className="text-[11px] text-slate-500/88">
                  {projection ? `${projection.items.length} projected items` : "No detail"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col overflow-hidden bg-transparent p-0">
            <Tabs defaultValue="summary" className="flex h-full w-full flex-col">
              <div className="px-4 py-2.5">
                <GlassSurface
                  className="inline-flex max-w-full overflow-x-auto rounded-[1.3rem] no-scrollbar"
                  refraction="none"
                  variant="toolbar"
                >
                  <TabsList className="h-9 w-max gap-1 rounded-[1.1rem] border-0 bg-transparent p-1 shadow-none">
                    <TabsTrigger value="summary" className={DETAIL_TAB_TRIGGER_CLASS}>
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="io" className={DETAIL_TAB_TRIGGER_CLASS}>
                      Input-Output
                    </TabsTrigger>
                    <TabsTrigger value="raw" className={DETAIL_TAB_TRIGGER_CLASS}>
                      Raw
                    </TabsTrigger>
                    <TabsTrigger value="tokens" className={DETAIL_TAB_TRIGGER_CLASS}>
                      Tokens
                    </TabsTrigger>
                    <TabsTrigger value="metrics" className={DETAIL_TAB_TRIGGER_CLASS}>
                      Related metrics
                    </TabsTrigger>
                  </TabsList>
                </GlassSurface>
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-4 pb-5 md:px-5 no-scrollbar">
                  <TabsContent value="summary" className="m-0 space-y-4 outline-none">
                    {chain ? (
                      <section className="rounded-[1.45rem] border border-sky-200/10 bg-[linear-gradient(180deg,rgba(8,15,24,0.76),rgba(7,13,22,0.54))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="mb-3 flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-sky-300" />
                          <h3 className="text-[12px] font-medium text-slate-300">Selection chain</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-sm text-slate-300/76 sm:grid-cols-2">
                          <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                            <p className="text-[11px] font-medium text-slate-500">Turn</p>
                            <p className="mt-1 text-slate-100">{chain.turn}</p>
                          </div>
                          <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                            <p className="text-[11px] font-medium text-slate-500">Flow</p>
                            <p className="mt-1 text-slate-100">{chain.flow}</p>
                          </div>
                          <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                            <p className="text-[11px] font-medium text-slate-500">Connector</p>
                            <p className="mt-1 text-slate-100">{chain.connector}</p>
                          </div>
                          <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                            <p className="text-[11px] font-medium text-slate-500">Related items</p>
                            <p className="mt-1 text-slate-100">{chain.relatedCount}</p>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    <section className="rounded-[1.45rem] border border-white/5 bg-white/[0.024] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="mb-3 flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-slate-400" />
                        <h3 className="text-[12px] font-medium text-slate-400">Summary</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200/88">{summaryBody}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-300/76 sm:grid-cols-2">
                        <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                          <p className="text-[11px] font-medium text-slate-500">Started</p>
                          <p className="mt-1 text-slate-100">
                            {selectedItem?.startedAt
                              ? formatTimestamp(selectedItem.startedAt)
                              : projection?.session.started_at
                                ? formatTimestamp(projection.session.started_at)
                                : "Awaiting runtime activity"}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                          <p className="text-[11px] font-medium text-slate-500">Duration</p>
                          <p className="mt-1 text-slate-100">
                            {selectedItem
                              ? formatDuration(selectedItem.startedAtMs, selectedItem.endedAtMs)
                              : projection
                                ? `${projection.items.length} projected items`
                                : "No data"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[1.45rem] border border-white/5 bg-white/[0.024] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <h3 className="mb-2 text-[12px] font-medium text-slate-400">Latest</h3>
                      <div className="space-y-2 text-sm text-slate-300/78">
                        <p>{latestItem?.summary ?? "No latest event payload available yet."}</p>
                        <p>
                          {latestItem?.startedAt
                            ? formatTimestamp(latestItem.startedAt)
                            : "Awaiting runtime activity"}
                        </p>
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="io" className="m-0 space-y-4 outline-none">
                    <section className="rounded-[1.45rem] border border-white/5 bg-white/[0.024] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="mb-3 flex items-center gap-2">
                        <Binary className="h-4 w-4 text-slate-400" />
                        <h3 className="text-[12px] font-medium text-slate-400">Input-Output</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <p className="mb-2 text-[11px] font-medium text-slate-500">Input</p>
                          <pre className="overflow-x-auto rounded-[1.15rem] border border-white/8 bg-[#0a1018]/60 p-3 text-[11px] text-slate-300 no-scrollbar">
{selectedItem?.inputPreview ??
  selectedItem?.payloadPreview ??
  "No input preview available for the current selection."}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] font-medium text-slate-500">Output</p>
                          <pre className="overflow-x-auto rounded-[1.15rem] border border-white/8 bg-[#0a1018]/60 p-3 text-[11px] text-slate-300 no-scrollbar">
{selectedItem?.outputPreview ??
  latestItem?.outputPreview ??
  "No output preview available for the current selection."}
                          </pre>
                        </div>
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="raw" className="m-0 outline-none">
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Braces className="h-4 w-4 text-slate-400" />
                        <p className="text-[12px] font-medium text-slate-400">
                          Raw selection payload
                        </p>
                      </div>
                      <pre className="w-full overflow-x-auto rounded-[1.45rem] border border-white/5 bg-[#0a1018]/64 p-4 text-[11px] text-slate-300/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] no-scrollbar">
{rawPayload}
                      </pre>
                    </section>
                  </TabsContent>

                  <TabsContent value="tokens" className="m-0 space-y-4 outline-none">
                    <section className="rounded-[1.45rem] border border-white/5 bg-white/[0.024] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="mb-3 flex items-center gap-2">
                        <DatabaseZap className="h-4 w-4 text-slate-400" />
                        <h3 className="text-[12px] font-medium text-slate-400">
                          {tokenState.label}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                          <p className="text-[11px] font-medium text-slate-500">Input</p>
                          <p className="mt-1 text-lg text-white">{tokenState.input}</p>
                        </div>
                        <div className="rounded-[1rem] border border-white/5 bg-[#09111d]/60 px-3 py-3">
                          <p className="text-[11px] font-medium text-slate-500">Output</p>
                          <p className="mt-1 text-lg text-white">{tokenState.output}</p>
                        </div>
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="metrics" className="m-0 space-y-4 outline-none">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {metrics.length > 0 ? (
                        metrics.map(metricCard)
                      ) : (
                        <section className="rounded-[1.4rem] border border-white/5 bg-white/[0.024] p-5 text-sm text-slate-300/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:col-span-2">
                          No metrics available for the selected session.
                        </section>
                      )}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </GlassSurface>
  );
}
