import type { EventRecord } from "../../run";
import { sanitizeMessagePreview } from "../lib/text";
import {
  detectCodexToolFailure,
  extractToolInputPreview,
  extractToolOutputPreview,
} from "../lib/toolPreview";
import { createEntryEvent } from "./eventBuilderRecord";
import type { EntryContext } from "./eventBuilderTypes";

export function buildFunctionCallEvent(context: EntryContext): EventRecord {
  const { entry } = context;
  const functionName = entry.functionName ?? "unknown";

  if (functionName === "spawn_agent") {
    return createEntryEvent({
      ...context,
      eventType: "tool.started",
      title: "spawn_agent",
      inputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
      outputPreview: null,
      toolName: functionName,
    });
  }

  if (functionName === "close_agent") {
    return createEntryEvent({
      ...context,
      eventType: "agent.finished",
      title: "Agent closed",
      inputPreview: entry.functionArgumentsPreview,
      outputPreview: null,
      toolName: functionName,
    });
  }

  if (functionName === "update_plan") {
    return createEntryEvent({
      ...context,
      eventType: "note",
      title: "Plan updated",
      inputPreview: null,
      outputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
      toolName: functionName,
    });
  }

  if (functionName === "request_user_input") {
    return createEntryEvent({
      ...context,
      eventType: "tool.started",
      title: "User input requested",
      inputPreview: entry.functionArgumentsPreview,
      outputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
      waitReason: "awaiting user",
      toolName: functionName,
    });
  }

  if (functionName === "wait" || functionName === "wait_agent") {
    return createEntryEvent({
      ...context,
      eventType: "tool.started",
      title: "Waiting for agents",
      inputPreview: entry.functionArgumentsPreview,
      outputPreview: null,
      waitReason: "awaiting agents",
      toolName: functionName,
    });
  }

  return createEntryEvent({
    ...context,
    eventType: "tool.started",
    title: functionName,
    inputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
    outputPreview: null,
    toolName: functionName,
  });
}

export function buildFunctionCallOutputEvent(
  context: EntryContext,
  callIdToName: Map<string, string>,
): EventRecord {
  const { entry } = context;
  const toolName = entry.functionCallId
    ? callIdToName.get(entry.functionCallId) ?? "unknown"
    : "unknown";
  const outputText = entry.text
    ? sanitizeToolOutput(toolName, entry.text)
    : null;

  const exitCodeMatch = entry.text?.match(/Process exited with code (\d+)/);
  const failedExitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 0;
  const isExecFailed =
    failedExitCode !== 0 || (entry.text?.startsWith("exec_command failed") ?? false);
  const isToolOutputFailed = !isExecFailed && detectCodexToolFailure(entry.text);
  const errorMessage =
    failedExitCode !== 0
      ? `Exit code ${failedExitCode}`
      : isExecFailed
        ? "Command rejected"
        : isToolOutputFailed
          ? "Tool failed"
          : undefined;

  const event = createEntryEvent({
    ...context,
    eventType: "tool.finished",
    title: toolName === "request_user_input" ? "User responded" : `${toolName} result`,
    inputPreview: null,
    outputPreview: outputText,
    toolName,
    errorMessage,
  });

  if (isExecFailed || isToolOutputFailed) {
    event.status = "failed";
  }

  return event;
}

function sanitizeToolOutput(toolName: string, rawOutput: string) {
  return sanitizeMessagePreview(extractToolOutputPreview(toolName, rawOutput));
}
