import type { AnomalyJump } from "../../../entities/run";
import { Button } from "../../../shared/ui/primitives";

interface MonitorGraphToolbarProps {
  anomalyJumps: AnomalyJump[];
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
}

export function MonitorGraphToolbar({
  anomalyJumps,
  onJump,
}: MonitorGraphToolbarProps) {
  return (
    <section className="grid gap-3 border border-x-0 border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="grid gap-2">
        <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
          Anomaly jumps
        </p>
        <div className="flex flex-wrap gap-2">
          {anomalyJumps.map((jump) => (
            <AnomalyJumpButton key={jump.label} jump={jump} onJump={onJump} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AnomalyJumpButton({
  jump,
  onJump,
}: {
  jump: AnomalyJump;
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={
        jump.emphasis === "danger"
          ? "h-8 rounded-full border-[color:var(--color-failed)]/35 bg-[color:color-mix(in_srgb,var(--color-failed)_8%,transparent)] px-3 text-[var(--color-failed)] hover:bg-[color:color-mix(in_srgb,var(--color-failed)_14%,transparent)]"
          : jump.emphasis === "warning"
            ? "h-8 rounded-full border-[color:var(--color-waiting)]/35 bg-[color:color-mix(in_srgb,var(--color-waiting)_8%,transparent)] px-3 text-[var(--color-waiting)] hover:bg-[color:color-mix(in_srgb,var(--color-waiting)_14%,transparent)]"
            : "h-8 rounded-full border-[color:var(--color-active)]/35 bg-[color:color-mix(in_srgb,var(--color-active)_8%,transparent)] px-3 text-[var(--color-active)] hover:bg-[color:color-mix(in_srgb,var(--color-active)_14%,transparent)]"
      }
      onClick={() => onJump(jump.selection)}
    >
      {jump.label}
    </Button>
  );
}
