import { ThemePreferenceSelect } from "../../../shared/theme";
import { Button } from "../../../shared/ui/primitives/button";
import { MonitorTopBarShell } from "../../../widgets/monitor-chrome";

interface SkillActivityTopBarProps {
  onNavigateToMonitor: () => void;
}

export function SkillActivityTopBar({ onNavigateToMonitor }: SkillActivityTopBarProps) {
  return (
    <MonitorTopBarShell
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onNavigateToMonitor}
            className="text-sm"
            aria-label="Back to monitor"
          >
            ← Monitor
          </Button>
          <ThemePreferenceSelect />
        </div>
      }
    >
      <h1 className="text-base font-semibold text-foreground">Skill Catalog Activity</h1>
    </MonitorTopBarShell>
  );
}
