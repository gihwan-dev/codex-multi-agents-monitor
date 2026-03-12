import { TAURI_RUNTIME_UNAVAILABLE_MESSAGE } from "@/shared/query";

export { TAURI_RUNTIME_UNAVAILABLE_MESSAGE };

export function formatRuntimeError(prefix: string, error: unknown) {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return `${prefix}: ${error}`;
  }

  return prefix;
}
