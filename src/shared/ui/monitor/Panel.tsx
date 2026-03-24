import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib";
import { PanelHeader } from "./PanelHeader";

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
      <PanelHeader
        actions={actions}
        headerClassName={headerClassName}
        title={title}
        titleClassName={titleClassName}
      />
      {children}
    </section>
  );
}
