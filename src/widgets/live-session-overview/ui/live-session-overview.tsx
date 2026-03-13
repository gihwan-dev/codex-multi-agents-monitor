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
  type SessionSummary,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";
import type { TimelineProjection } from "@/features/timeline";

import { deriveCoordinationSnapshot } from "../lib/coordination-summary";

interface LiveSessionOverviewProps {
  collapsed: boolean;
  degradedMessage: string | null;
  errorMessage: string | null;
  loading: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  projection: TimelineProjection | null;
  selectedSession: SessionSummary | null;
  snapshot: WorkspaceSessionsSnapshot | null;
}

const PANEL_CARD_CLASS =
  "flex h-full flex-col gap-0 overflow-hidden border-0 bg-transparent py-0 shadow-none ring-0";
const SUMMARY_META_LABEL_CLASS = "text-[10px] font-medium tracking-[0.03em] text-slate-500";
const SUMMARY_META_VALUE_CLASS =
  "truncate text-[12.5px] font-semibold tracking-[-0.015em] text-slate-100";
const SUMMARY_FACT_LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500";

function SummaryMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className={SUMMARY_META_LABEL_CLASS}>{label}</span>
      <span className={SUMMARY_META_VALUE_CLASS}>{value}</span>
    </div>
  );
}

function CoordinationFact({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="min-w-0 flex-1">
      <p className={SUMMARY_FACT_LABEL_CLASS}>{label}</p>
      <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[11.5px] leading-5 text-slate-300/74">{detail}</p>
    </section>
  );
}

export function LiveSessionOverview({
  collapsed,
  degradedMessage,
  errorMessage,
  loading,
  onCollapsedChange,
  projection,
  selectedSession,
  snapshot,
}: LiveSessionOverviewProps) {
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
  const coordinationSnapshot = deriveCoordinationSnapshot(projection);
  const coordinationFallback = selectedSession
    ? "Agent-to-agent orchestration will appear here as the session emits multi-agent activity."
    : "Select a live session to inspect current orchestration.";

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
              className="bg-transparent px-2 py-1 md:px-2.5 md:py-1.5"
              data-state={collapsed ? "collapsed" : "expanded"}
              data-testid="live-session-summary"
            >
              <div
                className="flex min-h-[2.1rem] min-w-0 items-center gap-2"
                data-testid="live-session-summary-bar"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Activity className="h-3 w-3 shrink-0 text-emerald-300/86" />
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        Live summary
                    </p>
                    <p
                      className="min-w-0 max-w-[clamp(7rem,14vw,13rem)] truncate text-[13px] font-semibold tracking-[-0.02em] text-white"
                      title={sessionTitle?.tooltip}
                    >
                      {compactSessionTitle}
                    </p>
                  </div>
                </div>

                <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 lg:flex">
                  <SummaryMeta label="Status" value={sessionStateLabel} />
                  <SummaryMeta label="Updated" value={compactLastEvent} />
                  <SummaryMeta label="Health" value={shellHealth} />
                </div>

                <CollapsibleTrigger
                  aria-label={collapsed ? "Expand live summary" : "Collapse live summary"}
                  className="shrink-0 text-[12px] font-medium text-slate-100 transition-colors hover:text-white focus-visible:outline-none"
                  data-testid="live-session-summary-trigger"
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{collapsed ? "Expand" : "Collapse"}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        collapsed ? "" : "rotate-180"
                      }`}
                    />
                  </span>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent>
                <div className="mt-2 border-t border-white/6 pt-2.5">
                  {coordinationSnapshot ? (
                    <div
                      className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-4"
                      data-testid="live-session-coordination"
                    >
                      <CoordinationFact
                        detail={coordinationSnapshot.currentTurn.detail}
                        label="Current turn"
                        value={coordinationSnapshot.currentTurn.label}
                      />
                      <CoordinationFact
                        detail={coordinationSnapshot.participants.detail}
                        label="Participants"
                        value={coordinationSnapshot.participants.label}
                      />
                      <CoordinationFact
                        detail={coordinationSnapshot.latestCoordination.detail}
                        label="Latest coordination"
                        value={coordinationSnapshot.latestCoordination.label}
                      />
                    </div>
                  ) : (
                    <p
                      className="text-[12px] leading-relaxed text-slate-300/72"
                      data-testid="live-session-coordination-empty"
                    >
                      {coordinationFallback}
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      </GlassSurface>
    </div>
  );
}
