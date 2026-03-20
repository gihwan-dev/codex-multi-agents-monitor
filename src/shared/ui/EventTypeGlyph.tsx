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
import type { EventType } from "../../entities/run";

const ICON_MAP: Record<EventType, LucideIcon> = {
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
  "handoff": ArrowRightLeft,
  "transfer": Forward,
  "error": AlertTriangle,
  "note": StickyNote,
  "user.prompt": MessageSquare,
  "turn.started": CornerDownRight,
  "turn.finished": CornerUpRight,
};

const COLOR_CLASSES: Record<EventType, string> = {
  "run.started": "event-icon--run-started",
  "run.finished": "event-icon--run-finished",
  "run.failed": "event-icon--run-failed",
  "run.cancelled": "event-icon--run-cancelled",
  "agent.spawned": "event-icon--agent-spawned",
  "agent.state_changed": "event-icon--agent-state-changed",
  "agent.finished": "event-icon--agent-finished",
  "llm.started": "event-icon--llm-started",
  "llm.finished": "event-icon--llm-finished",
  "tool.started": "event-icon--tool-started",
  "tool.finished": "event-icon--tool-finished",
  "handoff": "event-icon--handoff",
  "transfer": "event-icon--transfer",
  "error": "event-icon--error",
  "note": "event-icon--note",
  "user.prompt": "event-icon--user-prompt",
  "turn.started": "event-icon--turn-started",
  "turn.finished": "event-icon--turn-finished",
};

export function EventTypeGlyph({
  eventType,
  size = 14,
  className,
}: {
  eventType: EventType;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_MAP[eventType];
  return (
    <Icon
      size={size}
      className={[COLOR_CLASSES[eventType], className].filter(Boolean).join(" ")}
      aria-hidden="true"
      strokeWidth={2}
    />
  );
}
