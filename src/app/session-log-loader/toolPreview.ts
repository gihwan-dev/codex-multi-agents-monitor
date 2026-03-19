type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

export function parseJsonRecord(
  value: string | null | undefined,
): JsonRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readAgentReference(record: JsonRecord | null) {
  return {
    agentId:
      typeof record?.agent_id === "string"
        ? record.agent_id
        : typeof record?.agentId === "string"
          ? record.agentId
          : null,
    nickname:
      typeof record?.nickname === "string"
        ? record.nickname
        : typeof record?.agent_nickname === "string"
          ? record.agent_nickname
          : null,
  };
}

export function readStringArray(record: JsonRecord | null, key: string): string[] {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function extractToolInputPreview(
  toolName: string,
  rawPreview: string | null,
): string | null {
  if (!rawPreview) {
    return null;
  }

  const args = parseJsonRecord(rawPreview);
  if (args) {
    if (toolName === "exec_command" && typeof args.cmd === "string") {
      return args.cmd;
    }

    if (toolName === "apply_patch" && typeof args.path === "string") {
      return args.path;
    }

    if (toolName === "send_input" && typeof args.message === "string") {
      const prefix = args.interrupt ? "[interrupt] " : "";
      return `${prefix}${args.message}`;
    }

    if (toolName === "spawn_agent" && typeof args.message === "string") {
      const agentType =
        typeof args.type === "string"
          ? args.type
          : typeof args.agent_type === "string"
            ? args.agent_type
            : null;
      const prefix = agentType ? `[${agentType}] ` : "";
      return `${prefix}${args.message}`;
    }

    if (toolName === "update_plan" && typeof args.explanation === "string") {
      return args.explanation;
    }

    if (
      toolName === "request_user_input" &&
      Array.isArray(args.questions) &&
      isRecord(args.questions[0]) &&
      typeof args.questions[0].question === "string"
    ) {
      return args.questions[0].question;
    }

    if (toolName === "view_image" && typeof args.path === "string") {
      return args.path;
    }

    if (toolName === "write_stdin") {
      if (typeof args.input === "string") {
        return args.input;
      }

      if (typeof args.chars === "string" && args.chars.length > 0) {
        return args.chars;
      }

      return null;
    }

    if (toolName === "search_tool_bm25" && typeof args.query === "string") {
      return args.query;
    }

    if (toolName === "read_mcp_resource") {
      const parts = [args.server, args.uri].filter(
        (part): part is string => typeof part === "string" && part.length > 0,
      );
      return parts.length > 0 ? parts.join(":") : null;
    }

    if (
      toolName === "list_mcp_resources" ||
      toolName === "list_mcp_resource_templates" ||
      toolName === "read_thread_terminal"
    ) {
      return null;
    }
  }

  if (toolName === "apply_patch") {
    const fileMatch = rawPreview.match(/\*\*\* (?:Add|Update|Delete) File: (.+)/);
    if (fileMatch) {
      return fileMatch[1].trim();
    }
  }

  return rawPreview;
}

export function extractToolOutputPreview(toolName: string, rawOutput: string): string {
  if (toolName === "exec_command" || toolName === "write_stdin") {
    const outputMarker = rawOutput.indexOf("Output:\n");
    if (outputMarker !== -1) {
      const content = rawOutput.slice(outputMarker + "Output:\n".length).trim();
      return content || "(no output)";
    }
  }

  const parsed = parseJsonRecord(rawOutput);
  if (!parsed) {
    return rawOutput;
  }

  if (toolName === "wait" || toolName === "wait_agent") {
    if (parsed.timed_out) {
      return "Timed out (polling)";
    }

    if (isRecord(parsed.status)) {
      const entries = Object.values(parsed.status);
      if (entries.length === 0) {
        return "No agent status";
      }

      return entries
        .map((status) => {
          if (!isRecord(status)) {
            return "unknown";
          }
          if ("completed" in status) {
            return "completed";
          }
          if (typeof status.errored === "string") {
            return `errored: ${status.errored}`;
          }
          return "unknown";
        })
        .join(", ");
    }
  }

  if (toolName === "spawn_agent" && typeof parsed.nickname === "string") {
    return `Spawned: ${parsed.nickname}`;
  }

  if (toolName === "spawn_agent" && typeof parsed.agent_nickname === "string") {
    return `Spawned: ${parsed.agent_nickname}`;
  }

  if (toolName === "send_input") {
    return "Input delivered";
  }

  if (toolName === "request_user_input" && isRecord(parsed.answers)) {
    const firstAnswer = Object.values(parsed.answers)[0];
    if (isRecord(firstAnswer) && Array.isArray(firstAnswer.answers)) {
      const firstText = firstAnswer.answers[0];
      if (typeof firstText === "string") {
        return firstText;
      }
    }
  }

  if (
    (toolName === "resume_agent" || toolName === "close_agent") &&
    isRecord(parsed.status)
  ) {
    if (typeof parsed.status.completed === "string") {
      return parsed.status.completed;
    }
    if ("completed" in parsed.status) {
      return "Agent completed";
    }
    if (typeof parsed.status.errored === "string") {
      return `Agent errored: ${parsed.status.errored}`;
    }
  }

  if (typeof parsed.output === "string") {
    return parsed.output;
  }

  return rawOutput;
}

export function detectCodexToolFailure(
  rawOutput: string | null | undefined,
): boolean {
  const parsed = parseJsonRecord(rawOutput);
  if (!parsed) {
    return false;
  }

  if (
    isRecord(parsed.metadata) &&
    typeof parsed.metadata.exit_code === "number" &&
    parsed.metadata.exit_code !== 0
  ) {
    return true;
  }

  if (typeof parsed.output === "string") {
    return (
      parsed.output.includes("verification failed") ||
      parsed.output.includes("apply_patch failed")
    );
  }

  return false;
}
