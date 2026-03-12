import { useEffect, useState } from "react";

import {
  findSelectedSession,
  firstSessionId,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";

export function useSessionSelection(
  snapshot: WorkspaceSessionsSnapshot | null,
) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setSelectedSessionId((current) => {
      if (!current) {
        return firstSessionId(snapshot);
      }

      return findSelectedSession(snapshot, current)
        ? current
        : firstSessionId(snapshot);
    });
  }, [snapshot]);

  const selectedSession = findSelectedSession(snapshot, selectedSessionId);

  return {
    selectSession(sessionId: string) {
      setSelectedSessionId(sessionId);
    },
    selectedSession,
    selectedSessionId,
  };
}
