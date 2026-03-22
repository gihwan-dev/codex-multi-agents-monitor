import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib";

interface PanelProps extends PropsWithChildren {
  title?: string;
  actions?: ReactNode;
  panelSlot?: string;
  className?: string;
  titleClassName?: string;
  headerClassName?: string;
  style?: CSSProperties;
}

export function Panel({
  title,
  actions,
  panelSlot,
  className,
  titleClassName,
  headerClassName,
  style,
  children,
}: PanelProps) {
  return (
    <section
      data-slot={panelSlot ?? "monitor-panel"}
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-3 border p-4 text-foreground shadow-none",
        "border-[color:var(--color-chrome-border)]",
        "rounded-[var(--radius-panel)]",
        className,
      )}
      style={{ background: "var(--gradient-panel-surface)", ...style }}
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
