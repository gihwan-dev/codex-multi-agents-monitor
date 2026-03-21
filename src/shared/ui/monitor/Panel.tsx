import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib";

interface PanelProps extends PropsWithChildren {
  title?: string;
  actions?: ReactNode;
  panelSlot?: string;
  className?: string;
  titleClassName?: string;
  headerClassName?: string;
}

export function Panel({
  title,
  actions,
  panelSlot,
  className,
  titleClassName,
  headerClassName,
  children,
}: PanelProps) {
  return (
    <section
      data-slot={panelSlot ?? "monitor-panel"}
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-3 border border-white/8 bg-[linear-gradient(180deg,rgba(22,27,37,0.98),rgba(17,21,30,0.96))] p-4 text-foreground shadow-none",
        "rounded-[var(--radius-panel)]",
        className,
      )}
    >
      {(title || actions) && (
        <header
          className={cn(
            "flex items-start justify-between gap-3",
            headerClassName,
          )}
        >
          <div className="min-w-0">
            {title ? (
              <h2
                className={cn(
                  "text-[0.95rem] font-semibold tracking-[0.02em]",
                  titleClassName,
                )}
              >
                {title}
              </h2>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
