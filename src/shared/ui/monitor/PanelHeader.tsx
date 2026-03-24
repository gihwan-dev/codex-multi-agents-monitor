import type { ReactNode } from "react";

import { cn } from "../../lib";

interface PanelHeaderProps {
  actions?: ReactNode;
  headerClassName?: string;
  title?: string;
  titleClassName?: string;
}

export function PanelHeader({ actions, headerClassName, title, titleClassName }: PanelHeaderProps) {
  if (!title && !actions) {
    return null;
  }

  return (
    <header className={cn("flex items-start justify-between gap-3", headerClassName)}>
      <div className="min-w-0">
        {title ? <h2 className={cn("text-[0.95rem] font-semibold tracking-[0.02em]", titleClassName)}>{title}</h2> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
