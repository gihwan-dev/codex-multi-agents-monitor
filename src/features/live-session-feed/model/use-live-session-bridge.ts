import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";

import {
  upsertLiveSummary,
  type LiveSessionUpdate,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";
import {
  isTauriRuntimeAvailable,
  listenToLiveSessionUpdates,
  startLiveBridge,
} from "@/shared/api";
import { monitorQueryKeys } from "@/shared/query";

import { formatRuntimeError } from "./shared";

export function useLiveSessionBridge() {
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleLiveUpdate = useEffectEvent((update: LiveSessionUpdate) => {
    startTransition(() => {
      queryClient.setQueryData(
        monitorQueryKeys.workspaceSessions(),
        (current: WorkspaceSessionsSnapshot | undefined) =>
          upsertLiveSummary(current ?? null, update),
      );
    });
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: monitorQueryKeys.sessionDetail(update.summary.session_id),
    });
  });

  useEffect(() => {
    if (!isTauriRuntimeAvailable()) {
      setDegradedMessage(null);
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

      try {
        await startLiveBridge();
      } catch (error) {
        if (!cancelled) {
          setDegradedMessage(formatRuntimeError("Live bridge unavailable", error));
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [handleLiveUpdate, queryClient]);

  return {
    degradedMessage,
  };
}
