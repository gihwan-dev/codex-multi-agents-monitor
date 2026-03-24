import {
  isRecord,
  parseJsonRecord,
} from "./toolPreviewShared";

type InputPreviewReader = (record: Record<string, unknown>) => string | null | undefined;

interface ExtractToolInputPreviewOptions {
  toolName: string;
  rawPreview: string | null;
}

const NULL_INPUT_PREVIEW_TOOLS = new Set([
  "list_mcp_resources",
  "list_mcp_resource_templates",
  "read_thread_terminal",
]);
const STRUCTURED_INPUT_PREVIEW_READERS: Partial<
  Record<string, InputPreviewReader>
> = {
  apply_patch: (record) => readString(record.path),
  exec_command: (record) => readString(record.cmd),
  read_mcp_resource: readMcpResourcePreview,
  request_user_input: readUserInputPreview,
  search_tool_bm25: (record) => readString(record.query),
  send_input: readSendInputPreview,
  spawn_agent: readSpawnAgentPreview,
  update_plan: (record) => readString(record.explanation),
  view_image: (record) => readString(record.path),
  write_stdin: readWriteStdinPreview,
};

export function extractToolInputPreview(options: ExtractToolInputPreviewOptions): string | null {
  return options.rawPreview
    ? resolveToolInputPreview({ toolName: options.toolName, rawPreview: options.rawPreview })
    : null;
}

function resolveToolInputPreview(options: {
  toolName: string;
  rawPreview: string;
}) {
  const { toolName, rawPreview } = options;
  const structuredPreview = readStructuredInputPreview(toolName, rawPreview);
  if (structuredPreview !== undefined) {
    return structuredPreview;
  }

  return resolveFallbackInputPreview(toolName, rawPreview);
}

function readStructuredInputPreview(
  toolName: string,
  rawPreview: string,
): string | null | undefined {
  const args = parseJsonRecord(rawPreview);
  if (!args) {
    return undefined;
  }

  if (NULL_INPUT_PREVIEW_TOOLS.has(toolName)) {
    return null;
  }

  return STRUCTURED_INPUT_PREVIEW_READERS[toolName]?.(args);
}

function readSpawnAgentPreview(record: Record<string, unknown>) {
  const message = readString(record.message);
  if (!message) {
    return null;
  }

  const agentType = readString(record.type) ?? readString(record.agent_type);
  return agentType ? `[${agentType}] ${message}` : message;
}

function readSendInputPreview(record: Record<string, unknown>) {
  const message = readString(record.message);
  if (!message) {
    return null;
  }

  return record.interrupt ? `[interrupt] ${message}` : message;
}

function readUserInputPreview(record: Record<string, unknown>) {
  if (!Array.isArray(record.questions) || !isRecord(record.questions[0])) {
    return undefined;
  }

  return readString(record.questions[0].question);
}

function readMcpResourcePreview(record: Record<string, unknown>) {
  const parts = [readString(record.server), readString(record.uri)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(":") : null;
}

function readWriteStdinPreview(record: Record<string, unknown>) {
  const input = readString(record.input);
  if (input) {
    return input;
  }

  const chars = readString(record.chars);
  return chars && chars.length > 0 ? chars : null;
}

function extractApplyPatchTarget(rawPreview: string) {
  const fileMatch = rawPreview.match(/\*\*\* (?:Add|Update|Delete) File: (.+)/);
  return fileMatch ? fileMatch[1].trim() : rawPreview;
}

function resolveFallbackInputPreview(toolName: string, rawPreview: string) {
  return toolName === "apply_patch" ? extractApplyPatchTarget(rawPreview) : rawPreview;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
