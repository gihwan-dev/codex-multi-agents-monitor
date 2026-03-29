import type { buildGraphContextRailPresentation } from "./graphContextRailModel";

export function GraphContextCardHeader({
  presentation,
}: {
  presentation: NonNullable<ReturnType<typeof buildGraphContextRailPresentation>>;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Context window
        </span>
        <strong
          data-slot="graph-context-card-value"
          className="mt-2 block text-[1.6rem] font-semibold leading-none text-foreground"
        >
          {presentation.activeValueLabel}
        </strong>
      </div>
      <div className="min-w-0 text-right">
        <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Bottom of view
        </span>
        <span
          data-slot="graph-context-card-event"
          className="mt-1 block truncate text-[0.72rem] text-[var(--color-text-secondary)]"
        >
          {presentation.activeEventLabel}
        </span>
      </div>
    </div>
  );
}
