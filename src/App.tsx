import { useCallback, useRef, useState } from "react";
import type { RunDataset } from "./entities/run";
import { MonitorPage } from "./pages/monitor";
import { SkillActivityPage } from "./pages/skill-activity";
import { ThemeProvider } from "./shared/theme";

type AppView = "monitor" | "skill-activity";

function useViewState() {
  const [currentView, setCurrentView] = useState<AppView>("monitor");
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const goToSkills = useCallback(() => setCurrentView("skill-activity"), []);
  const goToMonitor = useCallback(() => setCurrentView("monitor"), []);
  const consumePendingEvent = useCallback(() => setPendingEventId(null), []);
  const navigateToEvent = useCallback((eventId: string) => {
    setPendingEventId(eventId);
    setCurrentView("monitor");
  }, []);
  return { currentView, pendingEventId, goToSkills, goToMonitor, consumePendingEvent, navigateToEvent };
}

function useDatasetsRef() {
  const datasetsRef = useRef<readonly RunDataset[]>([]);
  const activeRunIdRef = useRef("");
  const [version, setVersion] = useState(0);
  const sync = useCallback((datasets: readonly RunDataset[], activeRunId: string) => {
    datasetsRef.current = datasets;
    activeRunIdRef.current = activeRunId;
    setVersion((v) => v + 1);
  }, []);
  return { datasetsRef, activeRunIdRef, version, sync };
}

export function App() {
  const view = useViewState();
  const data = useDatasetsRef();

  return (
    <ThemeProvider>
      <div style={{ display: view.currentView === "monitor" ? "contents" : "none" }}>
        <MonitorPage
          onNavigateToSkills={view.goToSkills}
          onDatasetsSync={data.sync}
          pendingEventId={view.pendingEventId}
          onPendingEventConsumed={view.consumePendingEvent}
        />
      </div>
      {view.currentView === "skill-activity" && (
        <SkillActivityPage
          key={data.version}
          datasets={data.datasetsRef.current}
          activeRunId={data.activeRunIdRef.current}
          onNavigateToMonitor={view.goToMonitor}
          onNavigateToEvent={view.navigateToEvent}
        />
      )}
    </ThemeProvider>
  );
}
