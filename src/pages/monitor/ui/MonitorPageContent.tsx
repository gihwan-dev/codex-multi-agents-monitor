import {
  MonitorPageHeader,
  MonitorWorkspace,
} from "./MonitorPageSections";
import { MonitorShortcutsDialog } from "./MonitorShortcutsDialog";
import type { useMonitorPageView } from "./useMonitorPageView";

type MonitorPageView = ReturnType<typeof useMonitorPageView>;

function SelectionAnnouncement({
  announcement,
}: {
  announcement: string | null;
}) {
  if (!announcement) {
    return null;
  }

  return (
    <output className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </output>
  );
}

interface MonitorPageContentProps extends MonitorPageView {
  onNavigateToSkills?: () => void;
}

export function MonitorPageContent({ onNavigateToSkills, ...view }: MonitorPageContentProps) {
  return (
    <div className="monitor-shell">
      <SelectionAnnouncement
        announcement={view.selectionLoadState?.announcement ?? null}
      />
      <MonitorPageHeader {...view} onNavigateToSkills={onNavigateToSkills} />
      <MonitorWorkspace {...view} />
      <MonitorShortcutsDialog
        open={view.state.shortcutHelpOpen}
        onToggle={() => view.toggleShortcuts()}
        shortcutTriggerRef={view.shortcutTriggerRef}
      />
    </div>
  );
}
