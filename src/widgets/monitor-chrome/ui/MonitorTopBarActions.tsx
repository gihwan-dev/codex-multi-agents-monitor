import type { RunDataset } from "../../../entities/run";
import { ThemePreferenceSelect } from "../../../shared/theme";
import { Button } from "../../../shared/ui/primitives";
import { chromeActionClassName } from "./monitorTopBarStyles";

interface MonitorTopBarActionsProps {
  actionsDisabled?: boolean;
  dataset: RunDataset | null;
  followLive: boolean;
  onExport: (target: HTMLElement) => void;
  onNavigateToEval?: () => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: (target?: HTMLElement | null) => void;
  onNavigateToSkills?: () => void;
}

function resolveFollowLiveLabel(dataset: RunDataset | null, followLive: boolean) {
  return dataset?.run.liveMode === "live" && !followLive ? "Resume follow" : "Follow live";
}

function resolveFollowLiveButtonClassName(followLive: boolean) {
  return followLive
    ? "bg-[color:color-mix(in_srgb,var(--color-active)_18%,transparent)] text-foreground hover:bg-[color:color-mix(in_srgb,var(--color-active)_24%,transparent)]"
    : chromeActionClassName;
}

function NavigationActions({
  onNavigateToEval,
  onNavigateToSkills,
}: Pick<MonitorTopBarActionsProps, "onNavigateToEval" | "onNavigateToSkills">) {
  return (
    <>
      {onNavigateToSkills && (
        <Button
          type="button"
          variant="outline"
          className={chromeActionClassName}
          onClick={onNavigateToSkills}
        >
          Skills
        </Button>
      )}
      {onNavigateToEval && (
        <Button
          type="button"
          variant="outline"
          className={chromeActionClassName}
          onClick={onNavigateToEval}
        >
          Eval
        </Button>
      )}
    </>
  );
}

function FollowLiveAction({
  actionsDisabled,
  dataset,
  followLive,
  onToggleFollowLive,
}: Pick<
  MonitorTopBarActionsProps,
  "actionsDisabled" | "dataset" | "followLive" | "onToggleFollowLive"
>) {
  const followLiveDisabled = actionsDisabled || dataset?.run.liveMode !== "live";

  return (
    <Button
      type="button"
      variant={followLive ? "default" : "outline"}
      disabled={followLiveDisabled}
      onClick={onToggleFollowLive}
      className={resolveFollowLiveButtonClassName(followLive)}
    >
      {resolveFollowLiveLabel(dataset, followLive)}
    </Button>
  );
}

export function MonitorTopBarActions({
  actionsDisabled = false,
  dataset,
  followLive,
  onExport,
  onNavigateToEval,
  onToggleFollowLive,
  onToggleShortcuts,
  onNavigateToSkills,
}: MonitorTopBarActionsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <NavigationActions
        onNavigateToEval={onNavigateToEval}
        onNavigateToSkills={onNavigateToSkills}
      />
      <FollowLiveAction
        actionsDisabled={actionsDisabled}
        dataset={dataset}
        followLive={followLive}
        onToggleFollowLive={onToggleFollowLive}
      />
      <Button
        type="button"
        disabled={actionsDisabled || !dataset}
        onClick={(event) => dataset && onExport(event.currentTarget)}
        className="bg-primary text-primary-foreground"
      >
        Export
      </Button>
      <ThemePreferenceSelect />
      <Button
        type="button"
        variant="outline"
        className={chromeActionClassName}
        onClick={(event) => onToggleShortcuts(event.currentTarget)}
      >
        Help
      </Button>
    </div>
  );
}
