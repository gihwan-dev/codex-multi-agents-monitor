export type MonitorTab = "live" | "archive" | "dashboard";

export type DeferredMonitorTab = Exclude<MonitorTab, "live">;

export const TAB_COPY: Record<
  DeferredMonitorTab,
  { eyebrow: string; title: string; body: string }
> = {
  archive: {
    eyebrow: "SLICE-6",
    title: "Archive Monitor is staged next.",
    body:
      "Filter rails, dense results, and detail replay stay deferred until the archive slice lands.",
  },
  dashboard: {
    eyebrow: "SLICE-7",
    title: "Dashboard metrics are not wired yet.",
    body:
      "The shell reserves the KPI and anomaly surface, but metric aggregation and drill-down remain future work.",
  },
};
