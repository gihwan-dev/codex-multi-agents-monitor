import { GlassSurface } from "@/app/ui";
import { Activity, AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatTimestamp,
  type SessionSummary,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";

interface LiveSessionOverviewProps {
  degradedMessage: string | null;
  errorMessage: string | null;
  loading: boolean;
  selectedSession: SessionSummary | null;
  snapshot: WorkspaceSessionsSnapshot | null;
}

const PANEL_CARD_CLASS =
  "flex h-full flex-col gap-0 overflow-hidden border-0 bg-transparent shadow-none ring-0";
const HERO_METRIC_BLOCK_CLASS =
  "rounded-[1.05rem] border border-white/8 bg-white/[0.034] px-3.5 py-3 shadow-[0_10px_18px_rgba(2,6,23,0.1),inset_0_1px_0_rgba(255,255,255,0.06)]";
const RUNTIME_METRIC_BLOCK_CLASS =
  "rounded-[1.05rem] border border-white/5 bg-white/[0.022] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export function LiveSessionOverview({
  degradedMessage,
  errorMessage,
  loading,
  selectedSession,
  snapshot,
}: LiveSessionOverviewProps) {
  const sessions = snapshot?.workspaces.flatMap((workspace) => workspace.sessions) ?? [];
  const liveCount = sessions.filter((session) => session.status === "live").length;
  const stalledCount = sessions.filter((session) => session.status === "stalled").length;
  const sessionSourceLabel =
    selectedSession?.source_kind === "archive_log" ? "Archive replay" : "Session log";
  const shellHealth = errorMessage
    ? "Degraded"
    : degradedMessage
      ? "Partial"
      : loading
        ? "Syncing"
        : "Healthy";

  return (
    <div className="space-y-5">
      {errorMessage && !snapshot ? (
        <GlassSurface className="rounded-[1.6rem]" refraction="none" variant="danger">
          <Alert variant="destructive" className="border-0 bg-transparent px-5 py-4 shadow-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Shell fallback</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </GlassSurface>
      ) : null}

      {degradedMessage ? (
        <GlassSurface className="rounded-[1.6rem]" refraction="none" variant="warning">
          <Alert className="border-0 bg-transparent px-5 py-4 text-amber-100 shadow-none">
            <AlertCircle className="h-4 w-4 stroke-amber-400" />
            <AlertTitle className="text-amber-200">Live updates degraded</AlertTitle>
            <AlertDescription className="text-amber-100/80">
              {degradedMessage}
            </AlertDescription>
          </Alert>
        </GlassSurface>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
        <GlassSurface className="hero-panel h-full" refraction="none" variant="panel">
          <Card className={PANEL_CARD_CLASS}>
            <CardHeader className="bg-transparent px-5 pb-3 pt-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 max-w-[54rem]">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    Current session
                  </div>
                  <CardTitle className="max-w-[28ch] text-[clamp(1.8rem,3vw,2.85rem)] font-normal leading-[0.96] tracking-[-0.04em] text-white break-words">
                    {selectedSession
                      ? (selectedSession.title ?? "Untitled session")
                      : "Awaiting session selection"}
                  </CardTitle>
                  <p className="mt-2 max-w-[40rem] text-[13px] leading-relaxed text-slate-300/72">
                    {selectedSession
                      ? `${sessionSourceLabel} focused on the active run and its latest event pulse.`
                      : "Choose a session to bring its latest runtime activity into focus."}
                  </p>
                </div>
                <GlassSurface
                  className="shrink-0 rounded-full self-start"
                  interactive
                  refraction="soft"
                  variant="control"
                >
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] font-medium tracking-[0.01em] text-slate-100 capitalize">
                      {selectedSession?.status ?? (loading ? "Syncing" : "Ready")}
                    </span>
                  </div>
                </GlassSurface>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col bg-transparent px-5 pb-5 pt-0 text-slate-300">
              {selectedSession ? (
                <>
                  <div className="mb-3 rounded-[1.15rem] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] px-3.5 py-3 shadow-[0_12px_22px_rgba(2,6,23,0.1),inset_0_1px_0_rgba(255,255,255,0.07)]">
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      Focus
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-200/86">
                      {`${selectedSession.event_count} events in view. Latest update ${formatTimestamp(selectedSession.last_event_at)}.`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className={HERO_METRIC_BLOCK_CLASS}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        Status
                      </p>
                      <p className="text-[13px] font-medium capitalize text-slate-100">
                        {selectedSession.status}
                      </p>
                    </div>
                    <div className={HERO_METRIC_BLOCK_CLASS}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        Last event
                      </p>
                      <p className="text-[13px] font-medium text-slate-100">
                        {formatTimestamp(selectedSession.last_event_at)}
                      </p>
                    </div>
                    <div className={HERO_METRIC_BLOCK_CLASS}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        Events
                      </p>
                      <p className="text-[13px] font-medium text-slate-100">
                        {selectedSession.event_count}
                      </p>
                    </div>
                    <div className={HERO_METRIC_BLOCK_CLASS}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        Source
                      </p>
                      <p className="text-[13px] font-medium text-slate-100">
                        {selectedSession.source_kind === "archive_log"
                          ? "archive replay"
                          : "session log"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="rounded-[1.45rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-slate-300/74">
                  Select a session to inspect the latest activity.
                </p>
              )}
            </CardContent>
          </Card>
        </GlassSurface>

        <GlassSurface className="panel-subtle hidden h-full md:block" refraction="none" variant="panel">
          <Card className={PANEL_CARD_CLASS}>
            <CardHeader className="bg-transparent px-5 pb-2.5 pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-slate-400">Runtime</p>
                <span className="text-[11px] text-slate-500">{shellHealth}</span>
              </div>
              <CardTitle className="text-[1.2rem] font-normal tracking-tight text-white">
                Shell runtime
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 bg-transparent px-5 pb-5 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className={RUNTIME_METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    Live sessions
                  </p>
                  <p className="text-[13px] font-medium text-slate-100">{liveCount}</p>
                </div>
                <div className={RUNTIME_METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    Stalled
                  </p>
                  <p className="text-[13px] font-medium text-slate-100">{stalledCount}</p>
                </div>
                <div className={RUNTIME_METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    Selected events
                  </p>
                  <p className="text-[13px] font-medium text-slate-100">
                    {selectedSession?.event_count ?? "No session"}
                  </p>
                </div>
                <div className={RUNTIME_METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    Last refresh
                  </p>
                  <p className="text-[13px] font-medium text-slate-100">
                    {snapshot ? formatTimestamp(snapshot.refreshed_at) : "Awaiting feed"}
                  </p>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-400/70">
                {loading ? "Refreshing live feed." : "Live feed stable and waiting for the next change."}
              </p>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}
