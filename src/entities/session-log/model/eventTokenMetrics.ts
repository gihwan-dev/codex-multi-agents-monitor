import type { EventRecord } from "../../run";
import { parseTokenCountPayload } from "../lib/tokenCount";

export function normalizeEntryTokenMetrics(rawTokenCount: string | null) {
  const tokens = parseTokenCountPayload(rawTokenCount);
  if (!tokens) {
    return null;
  }

  return buildTokenMetricRecord(tokens);
}

function buildTokenMetricRecord(
  tokens: NonNullable<ReturnType<typeof parseTokenCountPayload>>,
) {
  const last = tokens.last;
  const total = tokens.total;
  return {
    tokensIn: resolveLastMetric(last, "in"),
    tokensOut: resolveLastMetric(last, "out"),
    reasoningTokens: resolveLastMetric(last, "reasoning"),
    cacheReadTokens: resolveLastMetric(last, "cached"),
    cacheWriteTokens: resolveLastMetric(last, "cacheWrite"),
    measuredContextWindowTokens: resolveMeasuredMetric(total, "in"),
    measuredCumulativeTokens: resolveMeasuredMetric(total, "total"),
  } satisfies Pick<
    EventRecord,
    | "tokensIn"
    | "tokensOut"
    | "reasoningTokens"
    | "cacheReadTokens"
    | "cacheWriteTokens"
    | "measuredContextWindowTokens"
    | "measuredCumulativeTokens"
  >;
}

function resolveTokenCount(value: number | undefined) {
  return typeof value === "number" ? value : 0;
}

function resolveLastMetric(
  usage: NonNullable<ReturnType<typeof parseTokenCountPayload>>["last"],
  key: "in" | "out" | "reasoning" | "cached" | "cacheWrite",
) {
  return resolveTokenCount(usage?.[key]);
}

function resolveMeasuredTokenCount(value: number | undefined) {
  return typeof value === "number" ? value : null;
}

function resolveMeasuredMetric(
  usage: NonNullable<ReturnType<typeof parseTokenCountPayload>>["total"],
  key: "in" | "total",
) {
  return resolveMeasuredTokenCount(usage?.[key]);
}
