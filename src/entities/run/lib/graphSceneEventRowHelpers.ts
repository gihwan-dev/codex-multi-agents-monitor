import type { BuildEventRowArgs } from "./graphSceneRowTypes.js";

export function resolveEventRowSummary({ waitReason, outputPreview, inputPreview }: BuildEventRowArgs["event"]) {
  return waitReason ?? outputPreview ?? inputPreview ?? "n/a";
}

export function buildEventRowTokenMetrics({ contextPoint, event }: BuildEventRowArgs) {
  return {
    inputTokens: resolveInputTokens(contextPoint, event),
    outputTokens: resolveOutputTokens(contextPoint, event),
    totalTokens: resolveTotalTokens(contextPoint, event),
    ...resolveContextPointMetrics(contextPoint),
  };
}

export function buildEventRowSelectionMetrics(args: BuildEventRowArgs) {
  const { event, hasMultiAgentTopology, selection, selectionPathEventIds } = args;

  return {
    inPath: hasMultiAgentTopology && selectionPathEventIds.has(event.eventId),
    selected: selection?.kind === "event" && selection.id === event.eventId,
  };
}

function resolveInputTokens(
  contextPoint: BuildEventRowArgs["contextPoint"],
  event: BuildEventRowArgs["event"],
) {
  return contextPoint?.inputTokens ?? event.tokensIn;
}

function resolveOutputTokens(
  contextPoint: BuildEventRowArgs["contextPoint"],
  event: BuildEventRowArgs["event"],
) {
  return contextPoint?.outputTokens ?? event.tokensOut;
}

function resolveTotalTokens(
  contextPoint: BuildEventRowArgs["contextPoint"],
  event: BuildEventRowArgs["event"],
) {
  return contextPoint?.totalTokens ?? event.tokensIn + event.tokensOut + event.reasoningTokens;
}

function resolveContextPointMetrics(contextPoint: BuildEventRowArgs["contextPoint"]) {
  return {
    cumulativeContextTokens: contextPoint?.cumulativeContextTokens ?? 0,
    contextWindowTokens: contextPoint?.contextWindowTokens ?? 0,
    hasCompaction: contextPoint?.hasCompaction ?? false,
  };
}
