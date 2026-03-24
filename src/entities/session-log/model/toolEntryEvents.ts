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
  const baseEvent = createEntryEvent({
    ...context,
    eventType: resolveFunctionCallEventType(functionName),
    title: resolveFunctionCallTitle(functionName),
    inputPreview: resolveFunctionCallInputPreview(functionName, entry.functionArgumentsPreview),
    outputPreview: resolveFunctionCallOutputPreview(functionName, entry.functionArgumentsPreview),
    waitReason: resolveFunctionCallWaitReason(functionName),
    toolName: functionName,
  });

  return baseEvent;
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
  const failure = resolveToolFailure(entry.text);

  const event = createEntryEvent({
    ...context,
    eventType: "tool.finished",
    title: resolveToolOutputTitle(toolName),
    inputPreview: null,
    outputPreview: outputText,
    toolName,
    errorMessage: failure?.errorMessage,
  });

  if (failure) {
    event.status = "failed";
  }

  return event;
}

function sanitizeToolOutput(toolName: string, rawOutput: string) {
  return sanitizeMessagePreview(extractToolOutputPreview(toolName, rawOutput));
}

function resolveFunctionCallEventType(
  functionName: string,
): EventRecord["eventType"] {
  if (functionName === "close_agent") {
    return "agent.finished";
  }

  return functionName === "update_plan" ? "note" : "tool.started";
}

function resolveFunctionCallTitle(functionName: string) {
  const titles: Record<string, string> = {
    close_agent: "Agent closed",
    request_user_input: "User input requested",
    update_plan: "Plan updated",
    wait: "Waiting for agents",
    wait_agent: "Waiting for agents",
  };

  return titles[functionName] ?? functionName;
}

function resolveFunctionCallInputPreview(
  functionName: string,
  rawPreview: string | null,
) {
  if (functionName === "close_agent" || functionName === "request_user_input") {
    return rawPreview;
  }

  return functionName === "update_plan"
    ? null
    : extractToolInputPreview({ toolName: functionName, rawPreview });
}

function resolveFunctionCallOutputPreview(
  functionName: string,
  rawPreview: string | null,
) {
  if (functionName === "update_plan" || functionName === "request_user_input") {
    return extractToolInputPreview({ toolName: functionName, rawPreview });
  }

  return null;
}

function resolveFunctionCallWaitReason(functionName: string) {
  if (functionName === "request_user_input") {
    return "awaiting user";
  }

  return functionName === "wait" || functionName === "wait_agent"
    ? "awaiting agents"
    : undefined;
}

function resolveToolOutputTitle(toolName: string) {
  return toolName === "request_user_input"
    ? "User responded"
    : `${toolName} result`;
}

function resolveToolFailure(rawOutput: string | null) {
  const exitCode = readFailedExitCode(rawOutput);
  if (exitCode !== null) {
    return { errorMessage: `Exit code ${exitCode}` };
  }

  if (rawOutput?.startsWith("exec_command failed")) {
    return { errorMessage: "Command rejected" };
  }

  return detectCodexToolFailure(rawOutput)
    ? { errorMessage: "Tool failed" }
    : null;
}

function readFailedExitCode(rawOutput: string | null) {
  const exitCodeMatch = rawOutput?.match(/Process exited with code (\d+)/);
  if (!exitCodeMatch) {
    return null;
  }

  const exitCode = parseInt(exitCodeMatch[1], 10);
  return exitCode === 0 ? null : exitCode;
}
