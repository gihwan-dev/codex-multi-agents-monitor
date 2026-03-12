import { GlassSurface } from "@/app/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionDetailQuery } from "@/features/session-detail";
import { formatTimestamp, type SessionSummary } from "@/entities/session";
import type { SessionDetailSnapshot } from "@/shared/queries";

interface DetailDrawerProps {
  detail: SessionDetailSnapshot | null;
  disableLiveQuery?: boolean;
  selectedSession: SessionSummary | null;
}

const PANEL_CARD_CLASS =
  "gap-0 flex h-full flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none ring-0";

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
    default:
      return "Select a session to inspect recent events.";
  }
}

export function DetailDrawer({
  detail,
  disableLiveQuery = false,
  selectedSession,
}: DetailDrawerProps) {
  const detailQuery = useSessionDetailQuery(
    disableLiveQuery ? null : detail ? null : selectedSession?.session_id ?? null,
  );
  const activeDetail = detail ?? detailQuery.detail;
  const sessionTitle =
    selectedSession?.title ?? activeDetail?.bundle.session.title ?? "Event detail";
  const summaryEvent = activeDetail?.bundle.events[0] ?? null;
  const latestEvent = activeDetail
    ? activeDetail.bundle.events[activeDetail.bundle.events.length - 1] ?? null
    : null;
  const metrics = activeDetail?.bundle.metrics ?? [];

  return (
    <GlassSurface
      refraction="none"
      variant="panel"
      className="flex h-full min-h-[520px] flex-col overflow-hidden"
    >
      <Card className={PANEL_CARD_CLASS}>
        <CardHeader className="bg-transparent px-5 pb-4 pt-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 max-w-[30rem]">
              <p className="mb-2 text-[11px] font-medium text-slate-400">Session detail</p>
              <CardTitle className="max-w-[24ch] text-[1.55rem] font-normal leading-[1.02] tracking-[-0.03em] text-white break-words">
                {sessionTitle}
              </CardTitle>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300/72">
                {describeStatus(selectedSession?.status)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:justify-end">
              <GlassSurface
                className="rounded-full"
                interactive
                refraction="soft"
                variant="control"
              >
                <div className="px-3 py-2">
                  <span className="text-[11px] font-medium tracking-[0.01em] text-slate-100 capitalize">
                    {selectedSession?.status ?? "Idle"}
                  </span>
                </div>
              </GlassSurface>
              <p className="text-[11px] text-slate-500">
                {selectedSession ? `${selectedSession.event_count} events` : "No session"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden bg-transparent p-0">
          <Tabs defaultValue="summary" className="flex h-full w-full flex-col">
            <div className="px-4 py-3">
              <GlassSurface
                className="inline-flex max-w-full overflow-x-auto rounded-[1.3rem] no-scrollbar"
                refraction="none"
                variant="toolbar"
              >
                <TabsList className="h-10 w-max gap-1 rounded-[1.1rem] border-0 bg-transparent p-1 shadow-none">
                  <TabsTrigger
                    value="summary"
                    className="rounded-[0.9rem] px-3.5 text-[12px] font-medium tracking-[0.01em] text-slate-300/74 data-[active]:border-white/8 data-[active]:bg-white/[0.12] data-[active]:text-white"
                  >
                    Summary
                  </TabsTrigger>
                  <TabsTrigger
                    value="io"
                    className="rounded-[0.9rem] px-3.5 text-[12px] font-medium tracking-[0.01em] text-slate-300/74 data-[active]:border-white/8 data-[active]:bg-white/[0.12] data-[active]:text-white"
                  >
                    I/O
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw"
                    className="rounded-[0.9rem] px-3.5 text-[12px] font-medium tracking-[0.01em] text-slate-300/74 data-[active]:border-white/8 data-[active]:bg-white/[0.12] data-[active]:text-white"
                  >
                    Raw
                  </TabsTrigger>
                  <TabsTrigger
                    value="metrics"
                    className="rounded-[0.9rem] px-3.5 text-[12px] font-medium tracking-[0.01em] text-slate-300/74 data-[active]:border-white/8 data-[active]:bg-white/[0.12] data-[active]:text-white"
                  >
                    Metrics
                  </TabsTrigger>
                </TabsList>
              </GlassSurface>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 pb-5 md:px-5 no-scrollbar">
                <TabsContent value="summary" className="m-0 space-y-4 outline-none">
                  <section className="rounded-[1.45rem] border border-white/6 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <h3 className="mb-2 text-[12px] font-medium text-slate-400">Summary</h3>
                    <p className="text-sm leading-relaxed text-slate-200/88">
                      {summaryEvent?.summary ??
                        "Latest summary will appear here once a session is selected."}
                    </p>
                    {summaryEvent?.payload_preview ? (
                      <p className="mt-3 text-sm leading-relaxed text-slate-300/72">
                        {summaryEvent.payload_preview}
                      </p>
                    ) : null}
                  </section>

                  <section className="rounded-[1.45rem] border border-white/6 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <h3 className="mb-2 text-[12px] font-medium text-slate-400">Latest</h3>
                    <div className="space-y-2 text-sm text-slate-300/78">
                      <p>{latestEvent?.summary ?? "No latest event payload available yet."}</p>
                      <p>
                        {latestEvent?.occurred_at
                          ? formatTimestamp(latestEvent.occurred_at)
                          : "Awaiting runtime activity"}
                      </p>
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="io" className="m-0 space-y-4 outline-none">
                  <section className="rounded-[1.45rem] border border-white/6 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <h3 className="mb-2 text-[12px] font-medium text-slate-400">Payload preview</h3>
                    <pre className="overflow-x-auto rounded-[1.15rem] border border-white/8 bg-[#0a1018]/60 p-3 text-[11px] text-slate-300 no-scrollbar">
{summaryEvent?.payload_preview ??
  "No payload preview available for the current selection."}
                    </pre>
                  </section>
                </TabsContent>

                <TabsContent value="raw" className="m-0 outline-none">
                  <pre className="w-full overflow-x-auto rounded-[1.45rem] border border-white/6 bg-[#0a1018]/68 p-4 text-[11px] text-slate-300/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] no-scrollbar">
{JSON.stringify(
  {
    session: activeDetail?.bundle.session ?? null,
    latestEvent,
  },
  null,
  2,
)}
                  </pre>
                </TabsContent>

                <TabsContent value="metrics" className="m-0 space-y-4 outline-none">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {metrics.length > 0 ? (
                      metrics.map((metric) => (
                        <section
                          key={metric.metric_id}
                          className="rounded-[1.4rem] border border-white/6 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        >
                          <p className="text-[11px] font-medium text-slate-500 capitalize">
                            {metric.name.split("_").join(" ")}
                          </p>
                          <p className="mt-2 text-xl text-white">{String(metric.value)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {metric.unit ?? "unitless"}
                          </p>
                        </section>
                      ))
                    ) : (
                      <section className="rounded-[1.4rem] border border-white/6 bg-white/[0.03] p-5 text-sm text-slate-300/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:col-span-2">
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
    </GlassSurface>
  );
}
