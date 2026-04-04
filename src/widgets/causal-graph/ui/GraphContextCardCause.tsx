import type { buildGraphContextRailPresentation } from "./graphContextRailModel";

export function GraphContextCardCause({
  presentation,
}: {
  presentation: NonNullable<ReturnType<typeof buildGraphContextRailPresentation>>;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-black/10 px-2.5 py-2">
      <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Cause
      </span>
      <span
        data-slot="graph-context-card-cause"
        className="mt-1 block truncate text-[0.76rem] text-[var(--color-text-secondary)]"
        title={presentation.causeEventLabel}
      >
        {presentation.causeEventLabel}
      </span>
    </div>
  );
}
