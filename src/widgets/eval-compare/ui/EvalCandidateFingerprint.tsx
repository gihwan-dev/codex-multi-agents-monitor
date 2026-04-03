import type { CandidateRun } from "../../../entities/eval";
import { truncateId } from "../../../shared/lib/format";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/primitives";

interface EvalCandidateFingerprintProps {
  title: string;
  run: CandidateRun;
}

function FingerprintRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground/90">{value}</span>
    </div>
  );
}

export function EvalCandidateFingerprint({
  title,
  run,
}: EvalCandidateFingerprintProps) {
  const fingerprint = run.fingerprint;

  return (
    <Card className="border-white/8 bg-white/[0.03]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {fingerprint.vendor} / {fingerprint.model}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{run.candidateLabel}</Badge>
            <Badge variant="secondary">{run.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FingerprintRow label="Repo SHA" value={truncateId(fingerprint.repoSha)} />
          <FingerprintRow label="Evaluator" value={fingerprint.evaluatorVersion} />
          <FingerprintRow label="Guidance hash" value={fingerprint.guidanceHash} />
          <FingerprintRow label="Skills hash" value={fingerprint.skillsHash} />
          <FingerprintRow label="MCP hash" value={fingerprint.mcpInventoryHash} />
          <FingerprintRow
            label="Policies"
            value={`${fingerprint.approvalPolicy} / ${fingerprint.sandboxPolicy}`}
          />
        </div>

        <div className="grid gap-2">
          <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
            Guidance preview
          </span>
          <p className="rounded-[var(--radius-soft)] border border-white/8 bg-black/10 px-3 py-2 text-sm leading-6 text-foreground/90">
            {fingerprint.guidancePreview}
          </p>
        </div>

        <div className="grid gap-2">
          <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
            Skills and MCP inventory
          </span>
          <div className="flex flex-wrap gap-2">
            {fingerprint.skillNamesPreview.map((skill) => (
              <Badge key={skill} variant="outline">
                skill:{skill}
              </Badge>
            ))}
            {fingerprint.mcpServers.map((server) => (
              <Badge key={server} variant="outline">
                mcp:{server}
              </Badge>
            ))}
            <Badge variant="secondary">
              {fingerprint.skillCount} skills / {fingerprint.mcpServerCount} MCPs
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
