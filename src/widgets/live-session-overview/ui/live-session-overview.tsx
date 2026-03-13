import { GlassSurface } from "@/app/ui";
import { Activity, AlertCircle, ChevronDown } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  formatSessionDisplayTitle,
  formatTimestamp,
  selectLiveWorkspaceSnapshot,
  type SessionSummary,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";

interface LiveSessionOverviewProps {
  collapsed: boolean;
  degradedMessage: string | null;
  errorMessage: string | null;
  loading: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  selectedSession: SessionSummary | null;
  snapshot: WorkspaceSessionsSnapshot | null;
}

const PANEL_CARD_CLASS =
  "flex h-full flex-col gap-0 overflow-hidden border-0 bg-transparent py-0 shadow-none ring-0";
const SUMMARY_SECTION_CLASS =
  "rounded-[1.15rem] border border-white/6 bg-white/[0.024] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const SUMMARY_CHIP_CLASS =
  "rounded-[0.95rem] border border-white/6 bg-[#09111d]/62 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const SUMMARY_LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500";

function sourceLabel(selectedSession: SessionSummary | null) {
  return selectedSession?.source_kind === "archive_log" ? "Archive replay" : "Session log";
}

function metaChip(label: string, value: string | number) {
  return (
    <div className={SUMMARY_CHIP_CLASS}>
      <p className={SUMMARY_LABEL_CLASS}>{label}</p>
      <p className="mt-1 text-[13px] font-medium text-slate-100">{value}</p>
    </div>
  );
}

export function LiveSessionOverview({
  collapsed,
  degradedMessage,
  errorMessage,
  loading,
  onCollapsedChange,
  selectedSession,
  snapshot,
}: LiveSessionOverviewProps) {
  const liveSnapshot = selectLiveWorkspaceSnapshot(snapshot);
  const sessions = liveSnapshot?.workspaces.flatMap((workspace) => workspace.sessions) ?? [];
  const liveCount = sessions.filter((session) => session.status === "live").length;
  const stalledCount = sessions.filter((session) => session.status === "stalled").length;
  const shellHealth = errorMessage
    ? "Degraded"
    : degradedMessage
      ? "Partial"
      : loading
        ? "Syncing"
        : "Healthy";
  const sessionTitle = selectedSession
    ? formatSessionDisplayTitle({
        rawTitle: selectedSession.title,
        workspacePath: selectedSession.workspace_path,
      })
    : null;
  const compactSessionTitle = sessionTitle?.displayTitle ?? "Awaiting session selection";
  const sessionStateLabel = selectedSession?.status ?? (loading ? "Syncing" : "Ready");
  const compactLastEvent = selectedSession
    ? formatTimestamp(selectedSession.last_event_at)
    : loading
      ? "Syncing"
      : "Pending";

  return (
    <div className="space-y-3">
      {errorMessage && !snapshot ? (
        <GlassSurface className="rounded-[1.6rem]" refraction="none" variant="danger">
          <Alert variant="destructive" className="border-0 bg-transparent px-4 py-3 shadow-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Shell fallback</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </GlassSurface>
      ) : null}

      {degradedMessage ? (
        <GlassSurface className="rounded-[1.6rem]" refraction="none" variant="warning">
          <Alert className="border-0 bg-transparent px-4 py-3 text-amber-100 shadow-none">
            <AlertCircle className="h-4 w-4 stroke-amber-400" />
            <AlertTitle className="text-amber-200">Live updates degraded</AlertTitle>
            <AlertDescription className="text-amber-100/80">
              {degradedMessage}
            </AlertDescription>
          </Alert>
        </GlassSurface>
      ) : null}

      <GlassSurface className="panel-subtle" refraction="none" variant="panel">
        <Collapsible
          open={!collapsed}
          onOpenChange={(open) => onCollapsedChange(!open)}
        >
          <Card className={PANEL_CARD_CLASS}>
            <CardContent
              className="bg-transparent px-1 py-0 md:px-1.5 md:py-0"
              data-state={collapsed ? "collapsed" : "expanded"}
              data-testid="live-session-summary"
            >
              <div
                className="flex min-h-[1.35rem] min-w-0 items-center gap-1"
                data-testid="live-session-summary-bar"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-0.5">
                    <div className="flex shrink-0 min-w-0 items-center gap-0.5">
                      <Activity className="h-2 w-2 shrink-0 text-emerald-300/86" />
                      <p className="text-[8px] font-medium uppercase tracking-[0.07em] text-slate-500">
                        Live summary
                      </p>
                    </div>
                    <p
                      className="min-w-0 flex-1 truncate text-[9px] font-medium tracking-[-0.02em] text-white"
                      title={sessionTitle?.tooltip}
                    >
                      {compactSessionTitle}
                    </p>
                  </div>
                </div>

                <div className="hidden min-w-0 flex-1 items-center justify-end gap-1.5 text-[10px] font-medium text-slate-300/82 lg:flex">
                  <span className="truncate">
                    Status, <span className="font-medium text-slate-100">{sessionStateLabel}</span>
                  </span>
                  <span className="truncate">
                    LastEvent, <span className="font-medium text-slate-100">{compactLastEvent}</span>
                  </span>
                  <span className="truncate">
                    HEALTH, <span className="font-medium text-slate-100">{shellHealth}</span>
                  </span>
                </div>

                <CollapsibleTrigger
                  aria-label={collapsed ? "Expand live summary" : "Collapse live summary"}
                  className="shrink-0 text-[10px] font-medium text-slate-100 transition-colors hover:text-white focus-visible:outline-none"
                  data-testid="live-session-summary-trigger"
                >
                  <span className="inline-flex items-center gap-0.5">
                    <span>{collapsed ? "Expand" : "Collapse"}</span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ${
                        collapsed ? "" : "rotate-180"
                      }`}
                    />
                  </span>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent>
                <div className="mt-2 border-t border-white/6 pt-2.5">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.04fr)]">
                    <section className={SUMMARY_SECTION_CLASS}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            <Activity className="h-3.5 w-3.5 text-slate-400" />
                            Live session
                          </div>
                          <p
                            className="mt-1.5 truncate text-[1.02rem] font-medium tracking-[-0.02em] text-white"
                            title={sessionTitle?.tooltip}
                          >
                            {compactSessionTitle}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400/78">
                            {sessionTitle?.workspaceLabel ?? "Select a session from the sidebar"}
                          </p>
                        </div>
                        <GlassSurface
                          className="shrink-0 rounded-full"
                          interactive
                          refraction="soft"
                          variant="control"
                        >
                          <div className="px-2.5 py-1.5">
                            <span className="text-[10.5px] font-medium tracking-[0.01em] text-slate-100 capitalize">
                              {sessionStateLabel}
                            </span>
                          </div>
                        </GlassSurface>
                      </div>
                      <p className="mt-3 text-[12px] leading-relaxed text-slate-300/70">
                        {selectedSession
                          ? `${sourceLabel(selectedSession)} selected for live inspection.`
                          : "Choose a session to bring the latest runtime activity into focus."}
                      </p>
                    </section>

                    <section className={SUMMARY_SECTION_CLASS}>
                      <p className={SUMMARY_LABEL_CLASS}>Selected session</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                        {metaChip("Events", selectedSession?.event_count ?? "No session")}
                        {metaChip(
                          "Last event",
                          selectedSession ? compactLastEvent : "Awaiting selection",
                        )}
                        {metaChip(
                          "Source",
                          selectedSession ? sourceLabel(selectedSession) : "Pending",
                        )}
                      </div>
                    </section>

                    <section className={SUMMARY_SECTION_CLASS}>
                      <p className={SUMMARY_LABEL_CLASS}>Runtime</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {metaChip("Live", liveCount)}
                        {metaChip("Stalled", stalledCount)}
                        {metaChip(
                          "Refresh",
                          liveSnapshot
                            ? formatTimestamp(liveSnapshot.refreshed_at)
                            : "Awaiting feed",
                        )}
                        {metaChip("Health", shellHealth)}
                      </div>
                    </section>
                  </div>
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      </GlassSurface>
    </div>
  );
}
