import type {
  AnomalyJump,
  EventType,
  RunDataset,
  RunFilters,
} from "../../../entities/run";
import {
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/primitives";

const EVENT_FILTER_OPTIONS = [
  "all",
  "note",
  "user.prompt",
  "tool.finished",
  "llm.finished",
  "error",
  "handoff",
  "transfer",
] as const satisfies ReadonlyArray<EventType | "all">;

const ALL_LANES_VALUE = "__all_lanes__";

type EventFilterOption = (typeof EVENT_FILTER_OPTIONS)[number];

const EVENT_FILTER_LABELS: Record<EventFilterOption, string> = {
  all: "All",
  note: "Messages",
  "user.prompt": "User prompts",
  "tool.finished": "Tool results",
  "llm.finished": "LLM calls",
  error: "Errors",
  handoff: "Handoff",
  transfer: "Transfer",
};

interface MonitorGraphToolbarProps {
  dataset: RunDataset;
  filters: RunFilters;
  anomalyJumps: AnomalyJump[];
  onJump: (selection: { kind: "event" | "edge" | "artifact"; id: string }) => void;
  onSetFilter: (key: keyof RunFilters, value: string | boolean | null) => void;
}

export function MonitorGraphToolbar({
  dataset,
  filters,
  anomalyJumps,
  onJump,
  onSetFilter,
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

      <div className="grid gap-2">
        <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
          Focus
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="grid gap-1">
            <span className="text-[0.72rem] text-muted-foreground">Agent</span>
            <Select
              value={filters.agentId ?? ALL_LANES_VALUE}
              onValueChange={(value) =>
                onSetFilter("agentId", value === ALL_LANES_VALUE ? null : value)
              }
            >
              <SelectTrigger className="w-[13rem] border-white/10 bg-white/[0.03] text-foreground">
                <SelectValue placeholder="All lanes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LANES_VALUE}>All lanes</SelectItem>
                {dataset.lanes.map((lane) => (
                  <SelectItem key={lane.laneId} value={lane.agentId}>
                    {lane.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-[0.72rem] text-muted-foreground">Event type</span>
            <Select
              value={filters.eventType}
              onValueChange={(value) => onSetFilter("eventType", value as EventType | "all")}
            >
              <SelectTrigger className="w-[13rem] border-white/10 bg-white/[0.03] text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_FILTER_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {EVENT_FILTER_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 text-[0.78rem] text-muted-foreground">
            <Checkbox
              aria-labelledby="monitor-toolbar-error-only"
              checked={filters.errorOnly}
              onCheckedChange={(checked) => onSetFilter("errorOnly", checked === true)}
              className="border-white/12 bg-white/[0.03] data-[state=checked]:border-[var(--color-active)] data-[state=checked]:bg-[var(--color-active)]"
            />
            <span id="monitor-toolbar-error-only">Error-only</span>
          </div>
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
