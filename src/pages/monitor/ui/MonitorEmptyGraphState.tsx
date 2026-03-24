import { LoadingStateBlock, Panel } from "../../../shared/ui";
import type { MonitorPageView } from "./monitorPageViewTypes";

export function MonitorEmptyGraphState({
  selectionLoadingPresentation,
}: Pick<MonitorPageView, "selectionLoadingPresentation">) {
  return (
    <Panel
      panelSlot="graph-panel"
      title={selectionLoadingPresentation?.title ?? "Graph"}
      className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-4 py-6">
        {selectionLoadingPresentation ? (
          <div className="w-full max-w-xl">
            <LoadingStateBlock
              title={selectionLoadingPresentation.title}
              message={selectionLoadingPresentation.message}
              phaseLabel={selectionLoadingPresentation.phaseLabel}
              targetEyebrow={selectionLoadingPresentation.targetEyebrow}
              targetTitle={selectionLoadingPresentation.targetTitle}
              targetMeta={selectionLoadingPresentation.targetMeta}
              skeletonRows={3}
            />
          </div>
        ) : (
          <div className="grid max-w-lg gap-2 text-center text-sm text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Select a run</p>
            <p>Select a recent or archived run to inspect.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
