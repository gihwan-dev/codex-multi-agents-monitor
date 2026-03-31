import { useEffect, useEffectEvent, useState } from "react";
import type { GraphSceneModel } from "../../../entities/run";

interface ViewportFocusState {
  traceId: string | null;
  viewportFocusEventId: string | null;
}

function matchesViewportFocusState(
  state: ViewportFocusState,
  traceId: string | null,
  viewportFocusEventId: string | null,
 ) {
  return state.traceId === traceId && state.viewportFocusEventId === viewportFocusEventId;
}

function resolveNextViewportFocusState(
  current: ViewportFocusState,
  traceId: string | null,
  viewportFocusEventId: string | null,
) {
  return matchesViewportFocusState(current, traceId, viewportFocusEventId)
    ? current
    : { traceId, viewportFocusEventId };
}

function resolveViewportFocusEventId(
  state: ViewportFocusState,
  activeTraceId: string | null,
  initialViewportFocusEventId: string | null,
) {
  return state.traceId === activeTraceId
    ? state.viewportFocusEventId
    : initialViewportFocusEventId;
}

export function resolveInitialViewportFocusEventId(rows: GraphSceneModel["rows"]) {
  return rows.find((row) => row.kind === "event")?.eventId ?? null;
}

export function useViewportFocusState(
  activeTraceId: string | null,
  initialViewportFocusEventId: string | null,
) {
  const [state, setState] = useState(() => ({
    traceId: activeTraceId,
    viewportFocusEventId: initialViewportFocusEventId,
  }));
  const viewportFocusEventId = resolveViewportFocusEventId(
    state,
    activeTraceId,
    initialViewportFocusEventId,
  );

  useEffect(() => {
    setState((current) =>
      resolveNextViewportFocusState(
        current,
        activeTraceId,
        initialViewportFocusEventId,
      ),
    );
  }, [activeTraceId, initialViewportFocusEventId]);

  const setViewportFocusEventId = useEffectEvent((eventId: string | null) => {
    setState((current) =>
      resolveNextViewportFocusState(current, activeTraceId, eventId),
    );
  });

  return {
    viewportFocusEventId,
    setViewportFocusEventId,
  };
}
