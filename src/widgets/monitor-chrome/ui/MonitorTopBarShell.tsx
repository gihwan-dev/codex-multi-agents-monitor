import type { ReactNode } from "react";

import { headerClassName, headerStyle } from "./monitorTopBarStyles";

interface MonitorTopBarShellProps {
  actions: ReactNode;
  children: ReactNode;
}

export function MonitorTopBarShell({ actions, children }: MonitorTopBarShellProps) {
  return (
    <header className={headerClassName} style={headerStyle}>
      {children}
      {actions}
    </header>
  );
}
