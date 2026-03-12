import { GlassSurface } from "@/app/ui";
import { Activity, AlertCircle, Sparkles, Terminal } from "lucide-react";

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

const PANEL_HEADER_CLASS =
  "bg-transparent px-6 pb-4 pt-5";
const PANEL_CARD_CLASS =
  "gap-0 overflow-hidden border-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.078),rgba(255,255,255,0.032)_18%,rgba(12,21,37,0.16)_44%,rgba(2,6,23,0.12)_100%)] shadow-none ring-0";
const METRIC_BLOCK_CLASS =
  "min-h-[5.25rem] rounded-[1.4rem] border border-white/7 bg-white/[0.04] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

export function LiveSessionOverview({
  degradedMessage,
  errorMessage,
  loading,
  selectedSession,
  snapshot,
}: LiveSessionOverviewProps) {
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
        <GlassSurface refraction="none" variant="panel">
          <Card className={PANEL_CARD_CLASS}>
            <CardHeader className={PANEL_HEADER_CLASS}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 max-w-[58rem]">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">
                    <Activity className="h-3.5 w-3.5" />
                    Selected session
                  </div>
                  <CardTitle className="max-w-[34ch] text-[clamp(2rem,3.2vw,3rem)] font-normal leading-[0.98] tracking-[-0.04em] text-white [overflow-wrap:anywhere]">
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
                  <div className="flex items-center gap-2 px-3.5 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-100">
                      {loading ? "syncing" : "ready"}
                    </span>
                  </div>
                </GlassSurface>
              </div>
            </CardHeader>
            <CardContent className="bg-transparent p-6 text-slate-300">
              {selectedSession ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                      Status
                    </p>
                    <p className="text-sm font-medium capitalize text-slate-100">
                      {selectedSession.status}
                    </p>
                  </div>
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                      Last event
                    </p>
                    <p className="text-sm font-medium text-slate-100">
                      {formatTimestamp(selectedSession.last_event_at)}
                    </p>
                  </div>
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                      Events
                    </p>
                    <p className="text-sm font-medium text-slate-100">
                      {selectedSession.event_count}
                    </p>
                  </div>
                  <div className={METRIC_BLOCK_CLASS}>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
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
                <p className="rounded-[1.4rem] border border-white/7 bg-white/[0.04] px-4 py-4 text-sm text-slate-300/78">
                  Choose a session from the sidebar once discovery returns data.
                </p>
              )}
            </CardContent>
          </Card>
        </GlassSurface>

        <GlassSurface refraction="none" variant="panel">
          <Card className={PANEL_CARD_CLASS}>
            <CardHeader className={PANEL_HEADER_CLASS}>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-sky-300">
                <Terminal className="h-3.5 w-3.5" />
                Shell state
              </div>
              <CardTitle className="text-[1.65rem] font-normal tracking-tight text-white">
                {loading ? "Scanning runtime edges..." : "Live shell in phase."}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-transparent p-6">
              <div className="rounded-[1.4rem] border border-white/7 bg-white/[0.04] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="max-w-[54ch] text-sm leading-relaxed text-slate-300/82">
                  Shared chrome is active across live, archive, and metrics. The
                  layout now favors floating controls over hard panel splits.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Unified backdrop", tone: "text-sky-200" },
                  { label: "Depth-first chrome", tone: "text-emerald-200" },
                  { label: "Desktop tuned", tone: "text-amber-200" },
                ].map((item) => (
                  <GlassSurface
                    key={item.label}
                    className="rounded-full"
                    refraction="none"
                    variant="control"
                  >
                    <div className={`px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] ${item.tone}`}>
                      {item.label}
                    </div>
                  </GlassSurface>
                ))}
              </div>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}
