import type { ReactNode } from "react";

interface CausalInspectorSectionProps {
  children: ReactNode;
  title: string;
}

export function CausalInspectorSection({
  children,
  title,
}: CausalInspectorSectionProps) {
  return (
    <section className="relative grid min-w-0 gap-2 overflow-hidden rounded-[10px] border border-white/8 bg-white/[0.025] px-3 py-3">
      <header>
        <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          {title}
        </h3>
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
