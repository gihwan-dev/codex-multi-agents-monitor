import type { RunDataset } from "../../../entities/run";
import { useSkillActivityPageView } from "../model/useSkillActivityPageView";
import { SkillActivityPageContent } from "./SkillActivityPageContent";

interface SkillActivityPageProps {
  datasets: readonly RunDataset[];
  activeRunId: string;
  onNavigateToMonitor: () => void;
  onNavigateToEvent: (eventId: string) => void;
}

export function SkillActivityPage({
  datasets,
  activeRunId,
  onNavigateToMonitor,
  onNavigateToEvent,
}: SkillActivityPageProps) {
  const view = useSkillActivityPageView({
    datasets,
    activeRunId,
    onNavigateToMonitor,
    onNavigateToEvent,
  });

  return <SkillActivityPageContent {...view} />;
}
