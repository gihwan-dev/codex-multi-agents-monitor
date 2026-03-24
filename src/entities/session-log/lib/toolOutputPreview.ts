import {
  isRecord,
  parseJsonRecord,
} from "./toolPreviewShared";

type OutputPreviewReader = (record: Record<string, unknown>) => string | null;

const STRUCTURED_OUTPUT_PREVIEW_READERS: Record<string, OutputPreviewReader> = {
  close_agent: readAgentLifecyclePreview,
  request_user_input: readUserAnswerPreview,
  resume_agent: readAgentLifecyclePreview,
  send_input: () => "Input delivered",
  spawn_agent: readSpawnedAgentPreview,
  wait: readWaitPreview,
  wait_agent: readWaitPreview,
};

export function extractToolOutputPreview(
  toolName: string,
  rawOutput: string,
): string {
  if (toolName === "exec_command" || toolName === "write_stdin") {
    return extractExecOutput(rawOutput);
  }

  const parsed = parseJsonRecord(rawOutput);
  if (!parsed) {
    return rawOutput;
  }

  const structuredPreview = extractStructuredOutputPreview(toolName, parsed);
  return structuredPreview ?? readFallbackOutput(rawOutput, parsed);
}

export function detectCodexToolFailure(
  rawOutput: string | null | undefined,
): boolean {
  const parsed = parseJsonRecord(rawOutput);
  if (!parsed) {
    return false;
  }

  if (hasNonZeroExitCode(parsed)) {
    return true;
  }

  const output = readString(parsed.output);
  return (
    typeof output === "string" &&
    (output.includes("verification failed") ||
      output.includes("apply_patch failed"))
  );
}

function extractExecOutput(rawOutput: string) {
  const outputMarker = rawOutput.indexOf("Output:\n");
  if (outputMarker === -1) {
    return rawOutput;
  }

  const content = rawOutput.slice(outputMarker + "Output:\n".length).trim();
  return content || "(no output)";
}

function extractStructuredOutputPreview(
  toolName: string,
  parsed: Record<string, unknown>,
): string | null {
  return STRUCTURED_OUTPUT_PREVIEW_READERS[toolName]?.(parsed) ?? null;
}

function readWaitPreview(parsed: Record<string, unknown>) {
  if (parsed.timed_out) {
    return "Timed out (polling)";
  }

  if (!isRecord(parsed.status)) {
    return null;
  }

  const entries = Object.values(parsed.status);
  if (entries.length === 0) {
    return "No agent status";
  }

  return entries.map(describeAgentStatus).join(", ");
}

function readSpawnedAgentPreview(parsed: Record<string, unknown>) {
  const nickname =
    readString(parsed.nickname) ?? readString(parsed.agent_nickname);
  return nickname ? `Spawned: ${nickname}` : null;
}

function readUserAnswerPreview(parsed: Record<string, unknown>) {
  if (!isRecord(parsed.answers)) {
    return null;
  }

  const firstAnswer = Object.values(parsed.answers)[0];
  if (!isRecord(firstAnswer) || !Array.isArray(firstAnswer.answers)) {
    return null;
  }

  return readString(firstAnswer.answers[0]);
}

function readAgentLifecyclePreview(parsed: Record<string, unknown>) {
  if (!isRecord(parsed.status)) {
    return null;
  }

  if (typeof parsed.status.completed === "string") {
    return parsed.status.completed;
  }

  if ("completed" in parsed.status) {
    return "Agent completed";
  }

  return typeof parsed.status.errored === "string"
    ? `Agent errored: ${parsed.status.errored}`
    : null;
}

function describeAgentStatus(status: unknown) {
  if (!isRecord(status)) {
    return "unknown";
  }

  if ("completed" in status) {
    return "completed";
  }

  return typeof status.errored === "string"
    ? `errored: ${status.errored}`
    : "unknown";
}

function readFallbackOutput(
  rawOutput: string,
  parsed: Record<string, unknown>,
) {
  const output = readString(parsed.output);
  return output ?? rawOutput;
}

function hasNonZeroExitCode(parsed: Record<string, unknown>) {
  return (
    isRecord(parsed.metadata) &&
    typeof parsed.metadata.exit_code === "number" &&
    parsed.metadata.exit_code !== 0
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
