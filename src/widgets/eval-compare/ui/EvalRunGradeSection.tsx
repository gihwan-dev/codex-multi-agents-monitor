import type { CandidateRun } from "../../../entities/eval";
import { Badge } from "../../../shared/ui/primitives";
import { gradeTone } from "./evalCompareViewHelpers";

interface EvalRunGradeSectionProps {
  run: CandidateRun;
}

export function EvalRunGradeSection({ run }: EvalRunGradeSectionProps) {
  const topGrades = [...run.grades]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">Grades</span>
        <Badge variant="outline">{run.grades.length} metrics</Badge>
      </div>
      {topGrades.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topGrades.map((grade) => (
            <Badge
              key={grade.id}
              variant={gradeTone(grade)}
              className="max-w-[12rem] truncate"
              title={`${grade.metricName}: ${grade.score}`}
            >
              {grade.metricName}: {grade.score}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No grades are attached to this run yet.</p>
      )}
    </div>
  );
}
