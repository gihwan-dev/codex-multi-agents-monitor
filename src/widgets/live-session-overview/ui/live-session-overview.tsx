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

const PANEL_HEADER_CLASS = "bg-transparent px-6 pb-5 pt-5";
const PANEL_CARD_CLASS =
  "flex h-full flex-col gap-0 overflow-hidden border-0 bg-transparent shadow-none ring-0";
const METRIC_BLOCK_CLASS =
  "min-h-[5rem] rounded-[1.45rem] border border-white/6 bg-white/[0.028] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <GlassSurface className="h-full" refraction="none" variant="panel">
          <Card className={PANEL_CARD_CLASS}>
            <CardHeader className={PANEL_HEADER_CLASS}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 max-w-[58rem]">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    Current session
                  </div>
                  <CardTitle className="max-w-[30ch] text-[clamp(2rem,3.2vw,3rem)] font-normal leading-[0.98] tracking-[-0.04em] text-white break-words">
                    {selectedSession
                      ? (selectedSession.title ?? "Untitled session")
                      : "Awaiting session selection"}
                  </CardTitle>
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
            <CardContent className="flex flex-1 flex-col bg-transparent p-6 text-slate-300">
              {selectedSession ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">
                      Status
                    </p>
                    <p className="text-sm font-medium capitalize text-slate-100">
                      {selectedSession.status}
                    </p>
                  </div>
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">
                      Last event
                    </p>
                    <p className="text-sm font-medium text-slate-100">
                      {formatTimestamp(selectedSession.last_event_at)}
                    </p>
                  </div>
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">
                      Events
                    </p>
                    <p className="text-sm font-medium text-slate-100">
                      {selectedSession.event_count}
                    </p>
                  </div>
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">
                      Source
                    </p>
                    <p className="text-sm font-medium text-slate-100">
                      {selectedSession.source_kind === "archive_log"
                        ? "archive replay"
                        : "session log"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-[1.45rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-slate-300/74">
                  Select a session to inspect the latest activity.
                </p>
              )}
            </CardContent>
          </Card>
        </GlassSurface>

        <GlassSurface className="h-full" refraction="none" variant="panel">
          <Card className={PANEL_CARD_CLASS}>
            <CardHeader className={PANEL_HEADER_CLASS}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-slate-400">Runtime</p>
                <span className="text-[11px] text-slate-500">{shellHealth}</span>
              </div>
              <CardTitle className="text-[1.65rem] font-normal tracking-tight text-white">
                Shell state
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 bg-transparent p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className={METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    Live sessions
                  </p>
                  <p className="text-sm font-medium text-slate-100">{liveCount}</p>
                </div>
                <div className={METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    Stalled
                  </p>
                  <p className="text-sm font-medium text-slate-100">{stalledCount}</p>
                </div>
                <div className={METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    Selected events
                  </p>
                  <p className="text-sm font-medium text-slate-100">
                    {selectedSession?.event_count ?? "No session"}
                  </p>
                </div>
                <div className={METRIC_BLOCK_CLASS}>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    Last refresh
                  </p>
                  <p className="text-sm font-medium text-slate-100">
                    {snapshot ? formatTimestamp(snapshot.refreshed_at) : "Awaiting feed"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                {loading ? "Refreshing live feed." : "Live feed stable."}
              </p>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}
