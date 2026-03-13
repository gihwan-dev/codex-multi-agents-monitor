import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { ChevronUp, X } from "lucide-react";

import { GlassSurface } from "@/app/ui";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import {
  buildTimelineProjection,
  resolveTimelineSelection,
  type TimelineMode,
  type TimelineProjection,
  type TimelineSelection,
  type TimelineSelectionContext,
} from "@/features/timeline";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useWorkspaceSessionsQuery } from "@/features/live-session-feed";
import { useSessionDetailQuery } from "@/features/session-detail";
import { useSessionSelection } from "@/features/session-selection";
import type { SessionDetailSnapshot, WorkspaceSessionsSnapshot } from "@/shared/queries";
import { type MonitorTab } from "@/shared/model";
import { ArchiveMonitor } from "@/widgets/archive-monitor";
import { DetailDrawer } from "@/widgets/detail-drawer";
import { LiveSessionOverview } from "@/widgets/live-session-overview";
import { MetricsDashboard } from "@/widgets/metrics-dashboard";
import { MonitorHeader } from "@/widgets/monitor-header";
import { TimelineCanvas } from "@/widgets/timeline";
import { WorkspaceSidebar } from "@/widgets/workspace-sidebar";
import type { MonitorUiQaState } from "../lib/ui-qa-fixtures";

interface MonitorPageProps {
  degradedMessage: string | null;
}

interface MonitorPageShellProps {
  degradedMessage: string | null;
  detailBySessionId?: Record<string, SessionDetailSnapshot>;
  errorMessage: string | null;
  initialActiveTab?: MonitorTab;
  initialDetailDrawerOpen?: boolean;
  initialSidebarOpen?: boolean;
  initialSummaryCollapsed?: boolean;
  loading: boolean;
  preferredSessionId?: string | null;
  snapshot: WorkspaceSessionsSnapshot | null;
  uiQaMode?: boolean;
}

interface MonitorWorkspaceLayoutProps {
  activeTab: MonitorTab;
  detailErrorMessage: string | null;
  detailDrawerOpen: boolean;
  detailLoading: boolean;
  degradedMessage: string | null;
  errorMessage: string | null;
  onDetailDrawerOpenChange: (open: boolean) => void;
  loading: boolean;
  onSelectSession: (sessionId: string) => void;
  summaryCollapsed: boolean;
  onSummaryCollapsedChange: (collapsed: boolean) => void;
  onTabChange: (tab: MonitorTab) => void;
  onTimelineSelectionChange: (selection: TimelineSelection) => void;
  projection: TimelineProjection | null;
  refreshedAt: string | null;
  selectedSession: ReturnType<typeof useSessionSelection>["selectedSession"];
  selectedSessionId: string | null;
  timelineSelectionContext: TimelineSelectionContext | null;
  timelineMode: TimelineMode;
  timelineSelection: TimelineSelection;
  snapshot: WorkspaceSessionsSnapshot | null;
}

type LayoutMap = {
  main: number;
  sidebar: number;
};

type PanelLayout = {
  [panelId: string]: number;
};

const DESKTOP_LAYOUT_STORAGE_KEY = "monitor-shell-desktop-layout";
const DEFAULT_DESKTOP_LAYOUT: LayoutMap = {
  main: 85,
  sidebar: 15,
};
const COLLAPSED_DESKTOP_LAYOUT: LayoutMap = {
  main: 100,
  sidebar: 0,
};

type SidebarSizing = {
  breakpoint: "wide" | "medium" | "compact";
  defaultSize: number;
  maxSize: number;
  minSize: number;
};

function getViewportWidth() {
  return typeof window === "undefined" ? 1440 : window.innerWidth;
}

function getDesktopSidebarSizing(viewportWidth: number): SidebarSizing {
  if (viewportWidth <= 1180) {
    return {
      breakpoint: "compact",
      defaultSize: 20.5,
      maxSize: 22.5,
      minSize: 19,
    };
  }

  if (viewportWidth <= 1280) {
    return {
      breakpoint: "medium",
      defaultSize: 17.5,
      maxSize: 19.5,
      minSize: 16.25,
    };
  }

  return {
    breakpoint: "wide",
    defaultSize: DEFAULT_DESKTOP_LAYOUT.sidebar,
    maxSize: 20.5,
    minSize: 11.5,
  };
}

function sanitizeLayoutForViewport(
  layout: LayoutMap,
  viewportWidth: number,
): LayoutMap {
  const sizing = getDesktopSidebarSizing(viewportWidth);
  const rawSidebar =
    Number.isFinite(layout.sidebar) && layout.sidebar > 0
      ? layout.sidebar
      : sizing.defaultSize;
  const sidebar = Math.min(Math.max(rawSidebar, sizing.minSize), sizing.maxSize);

  return {
    main: 100 - sidebar,
    sidebar,
  };
}

function readDesktopLayout(): LayoutMap {
  if (typeof window === "undefined") {
    return DEFAULT_DESKTOP_LAYOUT;
  }

  try {
    const storedValue = window.localStorage.getItem(DESKTOP_LAYOUT_STORAGE_KEY);
    if (!storedValue) {
      return DEFAULT_DESKTOP_LAYOUT;
    }

    const parsed = JSON.parse(storedValue) as Record<string, unknown>;
    if (typeof parsed.sidebar !== "number" || typeof parsed.main !== "number") {
      return DEFAULT_DESKTOP_LAYOUT;
    }

    return {
      main: parsed.main,
      sidebar: parsed.sidebar,
    };
  } catch {
    return DEFAULT_DESKTOP_LAYOUT;
  }
}

function persistDesktopLayout(layout: LayoutMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DESKTOP_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function createPanelLayout(layout: LayoutMap): PanelLayout {
  return {
    sidebar: layout.sidebar,
    main: layout.main,
  };
}

function layoutsMatch(currentLayout: PanelLayout, nextLayout: PanelLayout) {
  const panelIds = Object.keys(nextLayout);

  return panelIds.every((panelId) => {
    const currentValue = currentLayout[panelId];
    const nextValue = nextLayout[panelId];

    return (
      typeof currentValue === "number" &&
      typeof nextValue === "number" &&
      Math.abs(currentValue - nextValue) < 0.05
    );
  });
}

export function MonitorPage({ degradedMessage }: MonitorPageProps) {
  const { errorMessage, loading, snapshot } = useWorkspaceSessionsQuery();

  return (
    <MonitorPageShell
      degradedMessage={degradedMessage}
      errorMessage={errorMessage}
      loading={loading}
      snapshot={snapshot}
    />
  );
}

export function DemoMonitorPage({ uiQaState }: { uiQaState: MonitorUiQaState }) {
  return (
    <MonitorPageShell
      degradedMessage={null}
      detailBySessionId={uiQaState.detailBySessionId}
      errorMessage={null}
      initialActiveTab={uiQaState.activeTab}
      initialDetailDrawerOpen={uiQaState.detailDrawerOpen}
      initialSidebarOpen={uiQaState.sidebarOpen}
      initialSummaryCollapsed={uiQaState.summaryCollapsed}
      loading={false}
      preferredSessionId={uiQaState.selectedSessionId}
      snapshot={uiQaState.snapshot}
      uiQaMode
    />
  );
}

export function MonitorPageShell({
  degradedMessage,
  detailBySessionId,
  errorMessage,
  initialActiveTab = "live",
  initialDetailDrawerOpen = true,
  initialSidebarOpen = true,
  initialSummaryCollapsed = false,
  loading,
  preferredSessionId = null,
  snapshot,
  uiQaMode = false,
}: MonitorPageShellProps) {
  const [activeTab, setActiveTab] = useState<MonitorTab>(initialActiveTab);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(initialDetailDrawerOpen);
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [summaryCollapsed, setSummaryCollapsed] = useState(initialSummaryCollapsed);
  const [timelineSelection, setTimelineSelection] = useState<TimelineSelection>({
    kind: "session",
  });
  const { selectSession, selectedSession, selectedSessionId } =
    useSessionSelection(snapshot, preferredSessionId);
  const activeDetail =
    detailBySessionId && selectedSessionId
      ? detailBySessionId[selectedSessionId] ?? null
      : null;
  const detailQuery = useSessionDetailQuery(
    detailBySessionId || uiQaMode ? null : selectedSessionId,
  );
  const resolvedDetail = activeDetail ?? detailQuery.detail;
  const deferredDetail = useDeferredValue(resolvedDetail);
  const timelineProjection = useMemo(
    () => buildTimelineProjection(deferredDetail),
    [deferredDetail],
  );
  const timelineSelectionContext = useMemo(
    () => resolveTimelineSelection(timelineProjection, timelineSelection),
    [timelineProjection, timelineSelection],
  );

  useEffect(() => {
    setTimelineSelection({ kind: "session" });
  }, [selectedSessionId]);

  useEffect(() => {
    if (!timelineProjection || timelineSelection.kind === "session") {
      return;
    }

    const isValidSelection =
      (timelineSelection.kind === "item" &&
        timelineProjection.itemsById[timelineSelection.itemId] != null) ||
      (timelineSelection.kind === "segment" &&
        timelineProjection.segmentsById[timelineSelection.segmentId] != null) ||
      (timelineSelection.kind === "connector" &&
        timelineProjection.connectorsById[timelineSelection.connectorId] != null);

    if (!isValidSelection) {
      setTimelineSelection({ kind: "session" });
    }
  }, [timelineProjection, timelineSelection]);

  return (
    <div
      className="dark relative min-h-screen overflow-hidden bg-[#04060D] text-slate-100"
      data-monitor-shell=""
      data-ui-qa-mode={uiQaMode ? "true" : "false"}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(4, 6, 13, 0.84) 0%, rgba(7, 11, 20, 0.9) 48%, rgba(9, 13, 24, 0.98) 100%), radial-gradient(circle at 14% 14%, rgba(148, 163, 184, 0.045) 0%, transparent 28%), radial-gradient(circle at 78% 12%, rgba(226, 232, 240, 0.032) 0%, transparent 26%), radial-gradient(circle at 50% 100%, rgba(148, 163, 184, 0.03) 0%, transparent 36%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-18"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, transparent 0%, rgba(4, 6, 13, 0.14) 70%, rgba(4, 6, 13, 0.56) 100%), linear-gradient(rgba(148, 163, 184, 0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.018) 1px, transparent 1px)",
          backgroundSize: "auto, 144px 144px, 144px 144px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.032),transparent)] opacity-16" />

      <SidebarProvider
        className="relative z-10"
        open={uiQaMode ? sidebarOpen : undefined}
        onOpenChange={uiQaMode ? setSidebarOpen : undefined}
      >
        <MonitorWorkspaceLayout
          activeTab={activeTab}
          detailErrorMessage={activeDetail ? null : detailQuery.errorMessage}
          detailDrawerOpen={detailDrawerOpen}
          detailLoading={detailQuery.loading && !activeDetail}
          degradedMessage={degradedMessage}
          errorMessage={errorMessage}
          loading={loading}
          onDetailDrawerOpenChange={setDetailDrawerOpen}
          onSelectSession={selectSession}
          onSummaryCollapsedChange={setSummaryCollapsed}
          onTabChange={setActiveTab}
          onTimelineSelectionChange={setTimelineSelection}
          projection={timelineProjection}
          refreshedAt={snapshot?.refreshed_at ?? null}
          selectedSession={selectedSession}
          selectedSessionId={selectedSessionId}
          snapshot={snapshot}
          summaryCollapsed={summaryCollapsed}
          timelineSelectionContext={timelineSelectionContext}
          timelineMode="live"
          timelineSelection={timelineSelection}
        />
      </SidebarProvider>
    </div>
  );
}

function MonitorWorkspaceLayout({
  activeTab,
  detailErrorMessage,
  detailDrawerOpen,
  detailLoading,
  degradedMessage,
  errorMessage,
  loading,
  onDetailDrawerOpenChange,
  onSelectSession,
  onSummaryCollapsedChange,
  summaryCollapsed,
  onTabChange,
  onTimelineSelectionChange,
  projection,
  refreshedAt,
  selectedSession,
  selectedSessionId,
  snapshot,
  timelineSelectionContext,
  timelineMode,
  timelineSelection,
}: MonitorWorkspaceLayoutProps) {
  const { isMobile, open } = useSidebar();
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);
  const [desktopLayoutPreference, setDesktopLayoutPreference] = useState<LayoutMap>(() =>
    readDesktopLayout(),
  );
  const desktopGroupRef = useRef<GroupImperativeHandle | null>(null);
  const pendingProgrammaticLayoutRef = useRef<PanelLayout | null>(null);
  const sidebarSizing = getDesktopSidebarSizing(viewportWidth);
  const isFloatingDrawerViewport = !isMobile && viewportWidth >= 1280;
  const effectiveDesktopLayout = useMemo(
    () => sanitizeLayoutForViewport(desktopLayoutPreference, viewportWidth),
    [desktopLayoutPreference, viewportWidth],
  );
  const effectivePanelLayout = useMemo<PanelLayout>(
    () =>
      open
        ? createPanelLayout(effectiveDesktopLayout)
        : createPanelLayout(COLLAPSED_DESKTOP_LAYOUT),
    [effectiveDesktopLayout, open],
  );

  useEffect(() => {
    if (isMobile || typeof window === "undefined") {
      return;
    }

    const syncViewportWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);

    return () => {
      window.removeEventListener("resize", syncViewportWidth);
    };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    const panelGroup = desktopGroupRef.current;
    if (!panelGroup) {
      return;
    }

    const currentLayout = panelGroup.getLayout();
    if (layoutsMatch(currentLayout, effectivePanelLayout)) {
      pendingProgrammaticLayoutRef.current = null;
      return;
    }

    pendingProgrammaticLayoutRef.current = effectivePanelLayout;
    panelGroup.setLayout(effectivePanelLayout);
  }, [effectivePanelLayout, isMobile]);

  const sidebar = (
    <WorkspaceSidebar
      loading={loading}
      onSelectSession={onSelectSession}
      selectedSessionId={selectedSessionId}
      snapshot={snapshot}
    />
  );

  const handleTimelineSelectionChange = (selection: TimelineSelection) => {
    onTimelineSelectionChange(selection);
    if (selection.kind !== "session") {
      onDetailDrawerOpenChange(true);
    }
  };

  const mainContent = (
    <main
      className={`relative flex flex-1 flex-col overflow-hidden bg-transparent ${
        isMobile ? "min-h-screen" : "h-screen min-h-0"
      }`}
    >
      <MonitorHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        refreshedAt={refreshedAt}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-6 pt-2 md:px-5 lg:px-6">
        {activeTab === "live" ? (
          <div
            className="relative flex min-h-0 flex-1 flex-col gap-4"
            data-testid="live-workspace-content"
          >
            <div className="shrink-0">
              <LiveSessionOverview
                collapsed={summaryCollapsed}
                degradedMessage={degradedMessage}
                errorMessage={errorMessage}
                loading={loading}
                onCollapsedChange={onSummaryCollapsedChange}
                projection={projection}
                selectedSession={selectedSession}
                snapshot={snapshot}
              />
            </div>
            <div
              className="relative min-h-0 flex-1"
              data-drawer-mode={
                isFloatingDrawerViewport
                  ? detailDrawerOpen
                    ? "floating-open"
                    : "floating-closed"
                  : "stacked"
              }
              data-testid="live-timeline-stage"
            >
              <div className="flex min-h-0 h-full flex-col gap-4">
                <div className="min-h-0 min-w-0 flex-1">
                  <TimelineCanvas
                    errorMessage={detailErrorMessage}
                    loading={detailLoading}
                    mode={timelineMode}
                    onSelectionChange={handleTimelineSelectionChange}
                    projection={projection}
                    selectedSession={selectedSession}
                    selection={timelineSelection}
                    selectionContext={timelineSelectionContext}
                  />
                </div>
                {!isFloatingDrawerViewport ? (
                  <div className="min-h-0 min-w-0">
                    <DetailDrawer
                      errorMessage={detailErrorMessage}
                      loading={detailLoading}
                      onSelectionChange={handleTimelineSelectionChange}
                      projection={projection}
                      selectedSession={selectedSession}
                      selection={timelineSelection}
                      selectionContext={timelineSelectionContext}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {isFloatingDrawerViewport ? (
              <FloatingDetailDrawer
                errorMessage={detailErrorMessage}
                loading={detailLoading}
                onOpenChange={onDetailDrawerOpenChange}
                onSelectionChange={handleTimelineSelectionChange}
                open={detailDrawerOpen}
                projection={projection}
                selectedSession={selectedSession}
                selection={timelineSelection}
                selectionContext={timelineSelectionContext}
              />
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex min-h-full w-full flex-col gap-5">
              {activeTab === "archive" ? <ArchiveMonitor /> : <MetricsDashboard />}
            </div>
          </div>
        )}
      </div>
    </main>
  );

  if (isMobile) {
    return (
      <>
        {sidebar}
        {mainContent}
      </>
    );
  }

  return (
    <ResizablePanelGroup
      className="h-screen w-full overflow-hidden"
      data-sidebar-open={open ? "true" : "false"}
      defaultLayout={effectivePanelLayout}
      groupRef={desktopGroupRef}
      id="monitor-shell-desktop-layout"
      onLayoutChanged={(layout) => {
        const pendingProgrammaticLayout = pendingProgrammaticLayoutRef.current;
        if (pendingProgrammaticLayout && layoutsMatch(layout, pendingProgrammaticLayout)) {
          pendingProgrammaticLayoutRef.current = null;
          return;
        }

        pendingProgrammaticLayoutRef.current = null;
        if (typeof layout.sidebar !== "number" || typeof layout.main !== "number") {
          return;
        }

        const nextLayoutPreference = {
          main: layout.main,
          sidebar: layout.sidebar,
        };
        setDesktopLayoutPreference(nextLayoutPreference);
        persistDesktopLayout(nextLayoutPreference);
      }}
      orientation="horizontal"
    >
      <ResizablePanel
        defaultSize={open ? `${effectiveDesktopLayout.sidebar}%` : "0%"}
        id="sidebar"
        maxSize={`${sidebarSizing.maxSize}%`}
        minSize={open ? `${sidebarSizing.minSize}%` : "0%"}
      >
        {open ? (
          <div
            data-side="left"
            data-slot="sidebar-container"
            className="h-full min-h-0 min-w-0 overflow-hidden"
          >
            {sidebar}
          </div>
        ) : null}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className={`hidden w-6 bg-transparent after:hidden md:flex [&>div]:h-16 [&>div]:w-[2px] [&>div]:rounded-full [&>div]:bg-white/[0.085] [&>div]:shadow-[0_0_0_1px_rgba(255,255,255,0.035),0_0_14px_rgba(148,163,184,0.08),0_10px_22px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.12)] hover:[&>div]:bg-white/[0.16] hover:[&>div]:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_22px_rgba(191,219,254,0.14),0_14px_28px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.16)] focus-visible:[&>div]:bg-white/[0.18] focus-visible:[&>div]:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_26px_rgba(191,219,254,0.18),0_14px_28px_rgba(2,6,23,0.2),inset_0_1px_0_rgba(255,255,255,0.18)] ${
          open ? "" : "pointer-events-none opacity-0"
        }`}
      />
      <ResizablePanel
        defaultSize={open ? `${effectiveDesktopLayout.main}%` : "100%"}
        id="main"
        minSize={`${100 - sidebarSizing.maxSize}%`}
      >
        {mainContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

interface FloatingDetailDrawerProps {
  errorMessage: string | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectionChange: (selection: TimelineSelection) => void;
  open: boolean;
  projection: TimelineProjection | null;
  selectedSession: ReturnType<typeof useSessionSelection>["selectedSession"];
  selection: TimelineSelection;
  selectionContext: TimelineSelectionContext | null;
}

function FloatingDetailDrawer({
  errorMessage,
  loading,
  onOpenChange,
  onSelectionChange,
  open,
  projection,
  selectedSession,
  selection,
  selectionContext,
}: FloatingDetailDrawerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden items-stretch justify-end xl:flex"
      data-state={open ? "open" : "closed"}
      data-testid="timeline-detail-floating-shell"
    >
      <div className="relative flex h-full items-stretch">
        <GlassSurface
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 rounded-[1.4rem] border-white/10 shadow-[0_18px_60px_rgba(2,6,23,0.42)] transition-[opacity,transform] duration-200",
            open
              ? "pointer-events-none invisible translate-x-3 opacity-0"
              : "pointer-events-auto visible translate-x-0 opacity-100",
          )}
          interactive
          refraction="soft"
          variant="control"
        >
          <Button
            aria-label="Open detail drawer"
            className="h-28 w-11 rounded-[inherit] border-0 bg-transparent px-0 text-slate-100 shadow-none hover:bg-transparent hover:text-white"
            data-testid="timeline-detail-drawer-handle"
            onClick={() => onOpenChange(true)}
            size="sm"
            variant="ghost"
          >
            <span className="flex -rotate-90 items-center gap-2 whitespace-nowrap text-[11px] font-medium tracking-[0.08em] text-slate-200/86">
              <ChevronUp className="h-4 w-4" />
              Detail
            </span>
          </Button>
        </GlassSurface>

        <div
          className={cn(
            "pointer-events-none h-full transition-[opacity,transform] duration-200 ease-out",
            open
              ? "visible translate-x-0 opacity-100"
              : "invisible translate-x-[calc(100%+1rem)] opacity-0",
          )}
          style={{ width: "clamp(20rem, 31vw, 28rem)" }}
        >
          <div className="pointer-events-auto h-full pl-3">
            <div className="relative h-full">
              <GlassSurface
                className="absolute right-3 top-3 z-10 rounded-full shadow-[0_14px_42px_rgba(2,6,23,0.38)]"
                interactive
                refraction="soft"
                variant="control"
              >
                <Button
                  aria-label="Close detail drawer"
                  className="h-9 w-9 rounded-[inherit] border-0 bg-transparent p-0 text-slate-100 shadow-none hover:bg-transparent hover:text-white"
                  data-testid="timeline-detail-drawer-close"
                  onClick={() => onOpenChange(false)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </GlassSurface>
              <div className="h-full rounded-[1.7rem] shadow-[0_24px_80px_rgba(2,6,23,0.38)]">
                <DetailDrawer
                  errorMessage={errorMessage}
                  loading={loading}
                  onSelectionChange={onSelectionChange}
                  projection={projection}
                  selectedSession={selectedSession}
                  selection={selection}
                  selectionContext={selectionContext}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
