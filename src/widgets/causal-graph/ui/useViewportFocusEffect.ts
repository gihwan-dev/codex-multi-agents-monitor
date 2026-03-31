import { useLayoutEffect } from "react";

export function useViewportFocusEffect(
  onViewportFocusEventChange: ((eventId: string | null) => void) | undefined,
  viewportFocusEventId: string | null,
) {
  useLayoutEffect(() => {
    onViewportFocusEventChange?.(viewportFocusEventId);
  }, [onViewportFocusEventChange, viewportFocusEventId]);
}
