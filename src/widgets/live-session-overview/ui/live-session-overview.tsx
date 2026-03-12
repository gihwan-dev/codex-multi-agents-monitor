import { GlassSurface } from "@/app/ui";
import {
  Activity,
  AlertCircle,
  Terminal,
} from "lucide-react";

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

export function LiveSessionOverview({
  degradedMessage,
  errorMessage,
  loading,
  selectedSession,
  snapshot,
}: LiveSessionOverviewProps) {
  return (
    <div className="space-y-6">
      {errorMessage && !snapshot ? (
        <GlassSurface className="rounded-lg" refraction="none" variant="danger">
          <Alert variant="destructive" className="border-0 bg-transparent shadow-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Shell Fallback</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </GlassSurface>
      ) : null}

      {degradedMessage ? (
        <GlassSurface className="rounded-lg" refraction="none" variant="warning">
          <Alert className="border-0 bg-transparent text-amber-100 shadow-none">
            <AlertCircle className="h-4 w-4 stroke-amber-400" />
            <AlertTitle className="text-amber-300">Live Updates Degraded</AlertTitle>
            <AlertDescription className="text-amber-100/80">
              {degradedMessage}
            </AlertDescription>
          </Alert>
        </GlassSurface>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassSurface refraction="none" variant="panel">
          <Card className="overflow-hidden border-0 bg-transparent shadow-none ring-0">
            <CardHeader className="border-b border-white/5 bg-white/[0.03] pb-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-emerald-400">
                <Activity className="h-3.5 w-3.5" />
                Selected Session
              </div>
              <CardTitle className="text-2xl font-normal text-slate-100">
                {selectedSession
                  ? (selectedSession.title ?? "Untitled session")
                  : "No session selected"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-6 text-slate-400">
              {selectedSession ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                  <div>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Status
                    </p>
                    <p className="text-sm font-medium capitalize text-slate-200">
                      {selectedSession.status}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Last Event
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {formatTimestamp(selectedSession.last_event_at)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Events
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {selectedSession.event_count}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Source
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {selectedSession.source_kind}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm">
                  Choose a session from the sidebar once discovery returns data.
                </p>
              )}
            </CardContent>
          </Card>
        </GlassSurface>

        <GlassSurface refraction="none" variant="panel">
          <Card className="overflow-hidden border-0 bg-transparent shadow-none ring-0">
            <CardHeader className="border-b border-white/5 bg-white/[0.03] pb-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-blue-400">
                <Terminal className="h-3.5 w-3.5" />
                Shell Status
              </div>
              <CardTitle className="text-2xl font-normal text-slate-100">
                {loading ? "Scanning logs..." : "Live shell ready."}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-6">
              <p className="text-sm leading-relaxed text-slate-400">
                Sidebar grouping and summary selection are active. Timeline detail,
                archive filters, and dashboard metrics remain deferred to later
                slices.
              </p>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}
