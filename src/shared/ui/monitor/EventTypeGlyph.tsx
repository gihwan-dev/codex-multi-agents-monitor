import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Brain,
  BrainCircuit,
  CheckCircle,
  CornerDownRight,
  CornerUpRight,
  Forward,
  MessageSquare,
  Play,
  RefreshCw,
  SquareCheckBig,
  StickyNote,
  UserCheck,
  UserPlus,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "../../lib";

const ICON_MAP = {
  "run.started": Play,
  "run.finished": CheckCircle,
  "run.failed": XCircle,
  "run.cancelled": Ban,
  "agent.spawned": UserPlus,
  "agent.state_changed": RefreshCw,
  "agent.finished": UserCheck,
  "llm.started": BrainCircuit,
  "llm.finished": Brain,
  "tool.started": Wrench,
  "tool.finished": SquareCheckBig,
  handoff: ArrowRightLeft,
  transfer: Forward,
  error: AlertTriangle,
  note: StickyNote,
  "user.prompt": MessageSquare,
  "turn.started": CornerDownRight,
  "turn.finished": CornerUpRight,
} satisfies Record<string, LucideIcon>;

export type EventTypeGlyphType = keyof typeof ICON_MAP;

const COLOR_CLASSES: Record<EventTypeGlyphType, string> = {
  "run.started": "text-[var(--color-active)]",
  "run.finished": "text-[var(--color-success)]",
  "run.failed": "text-[var(--color-failed)]",
  "run.cancelled": "text-[var(--color-text-tertiary)]",
  "agent.spawned": "text-[var(--color-active)]",
  "agent.state_changed": "text-[var(--color-handoff)]",
  "agent.finished": "text-[var(--color-text-secondary)]",
  "llm.started": "text-[var(--color-text-secondary)]",
  "llm.finished": "text-[var(--color-text-secondary)]",
  "tool.started": "text-[var(--color-transfer)]",
  "tool.finished": "text-[var(--color-success)]",
  handoff: "text-[var(--color-handoff)]",
  transfer: "text-[var(--color-transfer)]",
  error: "text-[var(--color-failed)]",
  note: "text-[var(--color-text-tertiary)]",
  "user.prompt": "text-[var(--color-active)]",
  "turn.started": "text-[var(--color-text-tertiary)]",
  "turn.finished": "text-[var(--color-text-tertiary)]",
};

export function EventTypeGlyph({
  eventType,
  size = 14,
  className,
}: {
  eventType: EventTypeGlyphType;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_MAP[eventType];
  return (
    <Icon
      size={size}
      data-slot="event-type-glyph"
      data-event-type={eventType}
      className={cn(COLOR_CLASSES[eventType], className)}
      aria-hidden="true"
      strokeWidth={2}
    />
  );
}
