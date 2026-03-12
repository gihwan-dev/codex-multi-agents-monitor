import { LiquidGlassFilter } from "@/app/ui";
import { useLiveSessionBridge } from "@/features/live-session-feed";
import { MonitorPage } from "@/pages/monitor";

export function AppShell() {
  const { degradedMessage } = useLiveSessionBridge();

  return (
    <>
      <LiquidGlassFilter />
      <MonitorPage degradedMessage={degradedMessage} />
    </>
  );
}
