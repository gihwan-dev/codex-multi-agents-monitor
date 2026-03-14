import { StatusChip } from "./StatusChip";

interface LaneHeaderProps {
  name: string;
  role: string;
  model: string;
  badge: string;
  status: Parameters<typeof StatusChip>[0]["status"];
}

export function LaneHeader({ name, role, model, badge, status }: LaneHeaderProps) {
  return (
    <header className="lane-header">
      <div>
        <div className="lane-header__title-row">
          <strong>{name}</strong>
          <span className="lane-header__badge">{badge}</span>
        </div>
        <p className="lane-header__meta">
          {role} · {model}
        </p>
      </div>
      <StatusChip status={status} subtle />
    </header>
  );
}
