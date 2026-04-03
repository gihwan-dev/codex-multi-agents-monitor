import type { CandidateRun } from "../../../entities/eval";
import { Badge } from "../../../shared/ui/primitives";

interface EvalRunArtifactSectionProps {
  run: CandidateRun;
}

export function EvalRunArtifactSection({ run }: EvalRunArtifactSectionProps) {
  const totalArtifacts = run.artifacts.length;
  const recentArtifacts = run.artifacts.slice(0, 5);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">Artifacts</span>
        <div className="flex items-center gap-2">
          {totalArtifacts > 5 ? (
            <span className="text-xs text-muted-foreground">Showing 5 of {totalArtifacts}</span>
          ) : null}
          <Badge variant="outline">{totalArtifacts}</Badge>
        </div>
      </div>
      {recentArtifacts.length > 0 ? (
        recentArtifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="grid gap-1 rounded-[var(--radius-soft)] border border-white/8 bg-black/10 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{artifact.label}</span>
              <Badge variant="outline">{artifact.kind}</Badge>
            </div>
            {artifact.path && (
              <span className="font-mono text-xs text-muted-foreground">{artifact.path}</span>
            )}
            {artifact.preview && (
              <p className="line-clamp-3 text-sm text-foreground/90">{artifact.preview}</p>
            )}
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No artifacts were captured.</p>
      )}
    </div>
  );
}
