import { useCallback, useRef, useState } from "react";
import type { RunDataset } from "./entities/run";
import { EvalPage } from "./pages/eval";
import { MonitorPage } from "./pages/monitor";
import { SkillActivityPage } from "./pages/skill-activity";
import { ThemeProvider } from "./shared/theme";

type AppView = "monitor" | "skill-activity" | "eval";

function useViewState() {
  const [currentView, setCurrentView] = useState<AppView>("monitor");
  const goToSkills = useCallback(() => setCurrentView("skill-activity"), []);
  const goToMonitor = useCallback(() => setCurrentView("monitor"), []);
  const goToEval = useCallback(() => setCurrentView("eval"), []);
  return { currentView, goToSkills, goToMonitor, goToEval };
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
          isActive={view.currentView === "monitor"}
          onNavigateToSkills={view.goToSkills}
          onNavigateToEval={view.goToEval}
          onDatasetsSync={data.sync}
        />
      </div>
      {view.currentView === "skill-activity" && (
        <SkillActivityPage
          key={data.version}
          datasets={data.datasetsRef.current}
          activeRunId={data.activeRunIdRef.current}
          onNavigateToMonitor={view.goToMonitor}
        />
      )}
      {view.currentView === "eval" && (
        <EvalPage onNavigateToMonitor={view.goToMonitor} />
      )}
    </ThemeProvider>
  );
}
