export type MonitorTab = "live" | "archive" | "metrics";

export type DeferredMonitorTab = Exclude<MonitorTab, "live">;

export const TAB_COPY: Record<
  DeferredMonitorTab,
  { eyebrow: string; title: string; body: string }
> = {
  archive: {
    eyebrow: "SLICE-7",
    title: "Archive replay is staged next.",
    body:
      "Filter rails, dense results, and timeline replay consume the archive preset in the next slice.",
  },
  metrics: {
    eyebrow: "SLICE-8",
    title: "Dashboard metrics are not wired yet.",
    body:
      "The shell reserves the KPI and anomaly surface, but metric aggregation and drill-down remain future work.",
  },
};
