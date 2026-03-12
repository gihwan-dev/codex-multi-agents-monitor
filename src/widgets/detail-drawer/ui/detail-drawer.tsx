import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionDetailQuery } from "@/features/session-detail";
import { formatTimestamp, type SessionSummary } from "@/entities/session";
import type { SessionDetailSnapshot } from "@/shared/queries";
import {
  Activity,
  Eye,
  FileText,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

interface DetailDrawerProps {
  detail: SessionDetailSnapshot | null;
  disableLiveQuery?: boolean;
  selectedSession: SessionSummary | null;
}

const PANEL_CARD_CLASS =
  "gap-0 flex h-full flex-1 flex-col overflow-hidden border-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.078),rgba(255,255,255,0.03)_18%,rgba(12,21,37,0.16)_44%,rgba(2,6,23,0.14)_100%)] shadow-none ring-0";

function describeStatus(status: SessionSummary["status"] | undefined) {
  switch (status) {
    case "live":
      return "Live shell signal is flowing through the shared glass chrome.";
    case "completed":
      return "Capture is stable and ready for archive replay or QA review.";
    case "stalled":
      return "Runtime stalled. Preserve visibility, not noise, in the detail view.";
    case "archived":
      return "Archived replay uses the same shell but a colder diagnostic tone.";
    default:
      return "Select a session to inspect its latest reasoning and metrics.";
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
              <p className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-sky-300">
                <Eye className="h-3.5 w-3.5" /> Event detail
              </p>
              <CardTitle className="max-w-[22ch] text-[1.55rem] font-normal leading-[1.02] tracking-[-0.03em] text-white [overflow-wrap:anywhere]">
                {sessionTitle}
              </CardTitle>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300/78">
                {describeStatus(selectedSession?.status)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-100">
                    {selectedSession?.status ?? "idle"}
                  </span>
                </div>
              </GlassSurface>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] font-mono text-[10px] text-slate-300"
              >
                {selectedSession ? `${selectedSession.event_count} events` : "No session"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden bg-transparent p-0">
          <Tabs defaultValue="summary" className="flex h-full w-full flex-col">
            <div className="px-4 py-3">
              <GlassSurface className="inline-flex max-w-full overflow-x-auto rounded-[1.3rem]" refraction="none" variant="toolbar">
                <TabsList className="h-11 w-max gap-1 rounded-[1.15rem] border-0 bg-transparent p-1 shadow-none">
                  <TabsTrigger
                    value="summary"
                    className="rounded-[0.9rem] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
                  >
                    Summary
                  </TabsTrigger>
                  <TabsTrigger
                    value="io"
                    className="rounded-[0.9rem] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
                  >
                    Input / Output
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw"
                    className="rounded-[0.9rem] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
                  >
                    Raw
                  </TabsTrigger>
                  <TabsTrigger
                    value="metrics"
                    className="rounded-[0.9rem] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
                  >
                    Metrics
                  </TabsTrigger>
                </TabsList>
              </GlassSurface>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 pb-5 md:px-5">
                <TabsContent value="summary" className="m-0 space-y-4 outline-none">
                  <section className="rounded-[1.5rem] border border-white/7 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> Description
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-200/88">
                      {summaryEvent?.summary ??
                        "The selected session keeps the shell and detail chrome aligned on one unified backdrop."}
                    </p>
                    {summaryEvent?.payload_preview ? (
                      <p className="mt-3 text-sm leading-relaxed text-slate-300/72">
                        {summaryEvent.payload_preview}
                      </p>
                    ) : null}
                  </section>

                  <section className="rounded-[1.5rem] border border-white/7 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <Activity className="h-3.5 w-3.5" /> Latest pulse
                    </h3>
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
                  <section className="rounded-[1.5rem] border border-white/7 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <TerminalSquare className="h-3.5 w-3.5" /> Payload preview
                    </h3>
                    <pre className="overflow-x-auto rounded-[1.15rem] border border-white/8 bg-black/28 p-3 text-[11px] text-emerald-200">
{summaryEvent?.payload_preview ??
  "No payload preview. Use demo=ui-qa to keep a stable diagnostic fixture."}
                    </pre>
                  </section>
                </TabsContent>

                <TabsContent value="raw" className="m-0 outline-none">
                  <pre className="w-full overflow-x-auto rounded-[1.5rem] border border-white/7 bg-black/36 p-4 text-[11px] text-slate-300/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
                          className="rounded-[1.4rem] border border-white/7 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        >
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            {metric.name.split("_").join(" ")}
                          </p>
                          <p className="mt-2 text-xl text-white">{String(metric.value)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {metric.unit ?? "unitless"}
                          </p>
                        </section>
                      ))
                    ) : (
                      <section className="rounded-[1.4rem] border border-white/7 bg-white/[0.04] p-5 text-sm text-slate-300/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:col-span-2">
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
