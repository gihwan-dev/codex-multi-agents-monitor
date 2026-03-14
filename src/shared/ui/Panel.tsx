import type { PropsWithChildren, ReactNode } from "react";

interface PanelProps extends PropsWithChildren {
  title?: string;
  actions?: ReactNode;
  className?: string;
}

export function Panel({ title, actions, className = "", children }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || actions) && (
        <header className="panel__header">
          <div>
            {title ? <h2 className="panel__title">{title}</h2> : null}
          </div>
          {actions ? <div className="panel__actions">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
