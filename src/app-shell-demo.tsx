import { useMemo } from "react";

import { LiquidGlassProvider } from "@/app/ui";
import { DemoMonitorPage } from "@/pages/monitor";
import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

export function AppShellDemo() {
  const uiQaState = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : resolveMonitorUiQaState(window.location.search),
    [],
  );

  if (!uiQaState) {
    return null;
  }

  return (
    <LiquidGlassProvider>
      <DemoMonitorPage uiQaState={uiQaState} />
    </LiquidGlassProvider>
  );
}
