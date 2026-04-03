import type { Grade } from "../../../entities/eval";

export function gradeTone(grade: Grade) {
  if (grade.score >= 85) {
    return "default" as const;
  }
  if (grade.score >= 60) {
    return "secondary" as const;
  }
  return "destructive" as const;
}
