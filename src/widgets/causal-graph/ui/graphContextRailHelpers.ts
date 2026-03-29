import type { ContextObservabilityModel } from "../../../entities/run";
import { formatTokens } from "../../../shared/lib/format";
import type { GraphContextRailPresentation } from "./graphContextRailModel";

export function resolveRailTone(
  observability: ContextObservabilityModel,
  fillRatio: number,
): GraphContextRailPresentation["tone"] {
  if (!observability.maxContextWindowTokens) {
    return "default";
  }

  if (fillRatio >= 0.85) {
    return "danger";
  }

  if (fillRatio >= 0.65) {
    return "warning";
  }

  return "default";
}

export function resolveChangeTone(
  delta: number,
  hasCompaction: boolean,
): GraphContextRailPresentation["changeTone"] {
  if (hasCompaction || delta < 0) {
    return "success";
  }

  if (delta >= 20_000) {
    return "danger";
  }

  if (delta >= 8_000) {
    return "warning";
  }

  return "default";
}

export function formatDeltaLabel(delta: number, hasCompaction: boolean) {
  if (hasCompaction) {
    return "reset";
  }

  if (delta === 0) {
    return "steady";
  }

  const sign = delta > 0 ? "+" : "-";
  return `${sign}${formatTokenValue(Math.abs(delta))}`;
}

export function formatTokenValue(value: number) {
  return value > 0 ? formatTokens(value) : "0";
}
