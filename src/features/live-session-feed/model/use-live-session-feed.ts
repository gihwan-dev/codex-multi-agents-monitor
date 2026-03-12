import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import {
  mergeBootstrapSnapshot,
  upsertLiveSummary,
  type LiveSessionUpdate,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";
import {
  isTauriRuntimeAvailable,
  listenToLiveSessionUpdates,
  queryWorkspaceSessions,
  startLiveBridge,
} from "@/shared/api";

function formatRuntimeError(prefix: string, error: unknown) {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return `${prefix}: ${error}`;
  }

  return prefix;
}

export function useLiveSessionFeed() {
  const [snapshot, setSnapshot] = useState<WorkspaceSessionsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const snapshotRef = useRef<WorkspaceSessionsSnapshot | null>(null);

  const handleLiveUpdate = useEffectEvent((update: LiveSessionUpdate) => {
    startTransition(() => {
      setSnapshot((current) => {
        const nextSnapshot = upsertLiveSummary(current, update);
        snapshotRef.current = nextSnapshot;
        return nextSnapshot;
      });
    });
  });

  useEffect(() => {
    if (!isTauriRuntimeAvailable()) {
      setLoading(false);
      setErrorMessage("Tauri runtime unavailable. Launch the app with `pnpm tauri:dev`.");
      return;
    }

    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    async function bootstrap() {
      try {
        const nextUnlisten = await listenToLiveSessionUpdates((update) => {
          handleLiveUpdate(update);
        });

        if (cancelled) {
          void nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      } catch (error) {
        if (!cancelled) {
          setDegradedMessage(
            formatRuntimeError("Live update subscription unavailable", error),
          );
        }
      }

      const [snapshotResult, bridgeResult] = await Promise.allSettled([
        queryWorkspaceSessions(),
        startLiveBridge(),
      ]);

      if (cancelled) {
        return;
      }

      if (snapshotResult.status === "fulfilled") {
        const nextSnapshot = mergeBootstrapSnapshot(
          snapshotResult.value,
          snapshotRef.current,
        );
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        setErrorMessage(null);
      } else {
        setErrorMessage(
          formatRuntimeError(
            "Failed to load workspace snapshot",
            snapshotResult.reason,
          ),
        );
      }

      if (bridgeResult.status === "rejected") {
        setDegradedMessage(
          formatRuntimeError("Live bridge unavailable", bridgeResult.reason),
        );
      }

      setLoading(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [handleLiveUpdate]);

  return {
    degradedMessage,
    errorMessage,
    loading,
    snapshot,
  };
}
