import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  listen as tauriListen,
  type Event as TauriEvent,
  type UnlistenFn,
} from "@tauri-apps/api/event";

type TauriInvoke = typeof tauriInvoke;

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  }
}

export function canInvokeTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__?.invoke === "function"
  );
}

function resolveInvoke(): TauriInvoke {
  const invoke = canInvokeTauriRuntime() ? window.__TAURI_INTERNALS__?.invoke : undefined;
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

export type ListenTauriEvent<T> = TauriEvent<T>;
export type ListenTauriUnsubscribe = UnlistenFn;

export async function listenTauri<T>(
  eventName: string,
  handler: (event: ListenTauriEvent<T>) => void,
): Promise<ListenTauriUnsubscribe> {
  if (typeof window === "undefined") {
    throw new Error("Tauri runtime is unavailable.");
  }

  return tauriListen<T>(eventName, handler);
}
