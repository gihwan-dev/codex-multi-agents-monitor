import { useEvalPageView } from "../model/useEvalPageView";
import { EvalCaseListPanel } from "./EvalCaseListPanel";
import { EvalCompareWorkspace } from "./EvalCompareWorkspace";
import { EvalExperimentListPanel } from "./EvalExperimentListPanel";
import { EvalPageHeader } from "./EvalPageHeader";

interface EvalPageProps {
  onNavigateToMonitor: () => void;
}

export function EvalPage({ onNavigateToMonitor }: EvalPageProps) {
  const view = useEvalPageView({ onNavigateToMonitor });

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden p-4">
      <EvalPageHeader
        onNavigateToMonitor={view.onNavigateToMonitor}
        onRefresh={view.refresh}
      />

      <div className="grid min-h-0 gap-4 xl:grid-cols-[16rem_18rem_minmax(0,1fr)]">
        <EvalExperimentListPanel
          experiments={view.experiments}
          loading={view.loading}
          selectedExperimentId={view.selectedExperimentId}
          onSelect={view.selectExperiment}
        />
        <EvalCaseListPanel
          detail={view.detail}
          detailLoading={view.detailLoading}
          selectedCaseId={view.selectedCaseId}
          onSelect={view.selectCase}
        />
        <EvalCompareWorkspace
          baselineRunId={view.baselineRunId}
          candidateRunId={view.candidateRunId}
          caseRuns={view.caseRuns}
          compareLoading={view.compareLoading}
          comparison={view.comparison}
          error={view.error}
          selectedCase={view.selectedCase}
          onSelectBaselineRun={view.selectBaselineRun}
          onSelectCandidateRun={view.selectCandidateRun}
        />
      </div>
    </div>
  );
}
