import { invoke as tauriInvoke } from "@tauri-apps/api/core";

type TauriInvoke = typeof tauriInvoke;

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  }
}

function resolveInvoke(): TauriInvoke {
  const invoke = typeof window !== "undefined" ? window.__TAURI_INTERNALS__?.invoke : undefined;
  return typeof invoke === "function" ? invoke : tauriInvoke;
}

export async function invokeTauri<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("Tauri runtime is unavailable.");
  }

  return resolveInvoke()<T>(command, args);
}
