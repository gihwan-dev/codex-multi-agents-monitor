import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_RECENT_WORKSPACES = 4;

export function loadRecentSessionSnapshotsForWeb() {
  const sessionsRoot = path.join(os.homedir(), ".codex", "sessions");
  const projectsRoot = path.join(os.homedir(), "Documents", "Projects");
  const sessionFiles = collectJsonlFiles(sessionsRoot).sort().reverse();
  const snapshots = [];
  const seenOrigins = new Set();

  for (const sessionFile of sessionFiles) {
    if (snapshots.length >= MAX_RECENT_WORKSPACES) {
      break;
    }

    const snapshot = readSessionSnapshot(sessionFile, projectsRoot);
    if (!snapshot || seenOrigins.has(snapshot.originPath)) {
      continue;
    }

    seenOrigins.add(snapshot.originPath);
    snapshots.push(snapshot);
  }

  return snapshots;
}

function collectJsonlFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectJsonlFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".jsonl") ? [entryPath] : [];
  });
}

function readSessionSnapshot(sessionFile, projectsRoot) {
  const lines = fs.readFileSync(sessionFile, "utf8").split("\n").filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const sessionMeta = safeParse(lines[0]);
  const payload = sessionMeta?.payload;
  if (!payload || typeof payload.source !== "string" || typeof payload.cwd !== "string") {
    return null;
  }

  const originPath = resolveOriginPath(payload.cwd, projectsRoot);
  if (!originPath) {
    return null;
  }

  const messages = lines
    .slice(1)
    .map((line) => safeParse(line))
    .map(extractMessageSnapshot)
    .filter(Boolean);

  return {
    sessionId: typeof payload.id === "string" ? payload.id : path.basename(sessionFile, ".jsonl"),
    workspacePath: payload.cwd,
    originPath,
    displayName: path.basename(originPath),
    startedAt:
      typeof payload.timestamp === "string"
        ? payload.timestamp
        : typeof sessionMeta?.timestamp === "string"
          ? sessionMeta.timestamp
          : "",
    updatedAt: messages.at(-1)?.timestamp ?? payload.timestamp ?? sessionMeta?.timestamp ?? "",
    messages,
  };
}

function resolveOriginPath(workspacePath, projectsRoot) {
  const normalizedWorkspace = workspacePath.replace(/[\\/]+$/, "");
  const candidate = normalizedWorkspace.startsWith(projectsRoot)
    ? normalizedWorkspace
    : path.join(projectsRoot, path.basename(normalizedWorkspace));

  return candidate.startsWith(projectsRoot) ? candidate : null;
}

function extractMessageSnapshot(entry) {
  const payload = entry?.payload;
  if (payload?.type !== "message" || !["user", "assistant"].includes(payload?.role)) {
    return null;
  }

  const text = Array.isArray(payload.content)
    ? payload.content
        .flatMap((item) => {
          if (typeof item === "string") {
            return item.trim() ? [item.trim()] : [];
          }
          if (
            item &&
            typeof item === "object" &&
            ["input_text", "output_text", "text"].includes(item.type) &&
            typeof item.text === "string" &&
            item.text.trim()
          ) {
            return [item.text.trim()];
          }
          return [];
        })
        .join("\n")
    : "";

  if (!text) {
    return null;
  }

  return {
    timestamp: typeof entry.timestamp === "string" ? entry.timestamp : "",
    role: payload.role,
    text,
  };
}

function safeParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
