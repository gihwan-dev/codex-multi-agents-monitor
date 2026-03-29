import type { RunDataset } from "../../../entities/run";
import { useSkillActivityPageView } from "../model/useSkillActivityPageView";
import { SkillActivityPageContent } from "./SkillActivityPageContent";

interface SkillActivityPageProps {
  datasets: readonly RunDataset[];
  activeRunId: string;
  onNavigateToMonitor: () => void;
}

export function SkillActivityPage({
  datasets,
  activeRunId,
  onNavigateToMonitor,
}: SkillActivityPageProps) {
  const view = useSkillActivityPageView({
    datasets,
    activeRunId,
    onNavigateToMonitor,
  });

  return <SkillActivityPageContent {...view} />;
}
