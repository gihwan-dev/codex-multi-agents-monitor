import {
  formatCompactNumber,
  formatDuration,
  formatTimestamp,
} from "../../../shared/lib/format";
import type { EventRecord, SummaryFact } from "../model/types.js";

export function buildEventFacts(event: EventRecord): SummaryFact[] {
  const facts: Array<SummaryFact | null> = [
    { label: "Status", value: event.status },
    { label: "Started", value: formatTimestamp(event.startTs) },
    { label: "Duration", value: formatDuration(event.durationMs) },
    buildProviderFact(event),
    buildToolFact(event),
    buildModelFact(event),
    buildTokenFact(event),
    event.errorMessage
      ? { label: "Error", value: event.errorMessage, emphasis: "danger" }
      : null,
    buildFinishFact(event),
  ];

  return facts.filter(Boolean) as SummaryFact[];
}

function buildTokenFact(event: EventRecord): SummaryFact | null {
  const totalTokens = event.tokensIn + event.tokensOut;
  if (!hasTokenFactContent(event, totalTokens)) {
    return null;
  }

  const cacheSuffix = buildCacheSuffix(event);
  const reasoningSuffix =
    event.reasoningTokens > 0
      ? ` + ${formatCompactNumber(event.reasoningTokens)} reasoning`
      : "";

  return {
    label: "Tokens",
    value: `${formatCompactNumber(event.tokensIn)} in${cacheSuffix} / ${formatCompactNumber(event.tokensOut)} out${reasoningSuffix}`,
  };
}

function hasTokenFactContent(event: EventRecord, totalTokens: number) {
  return (
    totalTokens > 0 ||
    event.cacheReadTokens > 0 ||
    event.cacheWriteTokens > 0
  );
}

function buildCacheSuffix(event: EventRecord) {
  const cacheParts = [
    buildCachePart(event.cacheReadTokens, "cache read"),
    buildCachePart(event.cacheWriteTokens, "cache write"),
  ].filter(Boolean);

  return cacheParts.length > 0 ? ` (${cacheParts.join(" · ")})` : "";
}

function buildCachePart(value: number, label: string) {
  return value > 0 ? `${formatCompactNumber(value)} ${label}` : null;
}

function buildProviderFact(event: EventRecord): SummaryFact | null {
  return event.provider ? { label: "Provider", value: String(event.provider) } : null;
}

function buildToolFact(event: EventRecord): SummaryFact | null {
  return event.toolName ? { label: "Tool", value: event.toolName } : null;
}

function buildModelFact(event: EventRecord): SummaryFact | null {
  return event.model && event.model !== "human"
    ? { label: "Model", value: event.model }
    : null;
}

function buildFinishFact(event: EventRecord): SummaryFact | null {
  return event.finishReason && event.finishReason !== "stop"
    ? { label: "Finish", value: event.finishReason, emphasis: "warning" }
    : null;
}
