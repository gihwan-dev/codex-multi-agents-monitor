import type { SessionScoreRecord } from "../../../entities/session-log";

export function ProfileSnapshotSummary({
  record,
}: {
  record: SessionScoreRecord;
}) {
  return (
    <div className="grid gap-2 text-[0.76rem] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <span>{record.profileSnapshot.label}</span>
        {record.profileSnapshot.guidanceHash ? (
          <span className="font-mono text-[0.72rem]">
            {record.profileSnapshot.guidanceHash.slice(0, 8)}
          </span>
        ) : null}
      </div>
      <div className="grid gap-1">
        <span>Main model: {record.profileSnapshot.mainModel ?? record.profileSnapshot.provider}</span>
        <span>Subagents: {record.profileSnapshot.subagents.length}</span>
      </div>
      {record.profileSnapshot.subagents.length > 0 ? (
        <div className="grid gap-1">
          {record.profileSnapshot.subagents.map((subagent) => (
            <span
              key={`${subagent.provider}:${subagent.role}:${subagent.model ?? "unknown"}`}
            >
              {subagent.role} · {subagent.model ?? subagent.provider}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
