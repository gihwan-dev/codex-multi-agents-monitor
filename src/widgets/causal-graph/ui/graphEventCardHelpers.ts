export function resolveSummaryLine(
  outputPreview: string | null,
  inputPreview: string | null,
  summary: string,
) {
  return outputPreview ?? inputPreview ?? (summary !== "n/a" ? summary : null);
}

export function resolveBooleanDataFlag(value: boolean) {
  return value ? "true" : "false";
}
