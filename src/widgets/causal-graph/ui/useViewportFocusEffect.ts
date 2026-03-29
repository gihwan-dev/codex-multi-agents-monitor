import { useEffect } from "react";

export function useViewportFocusEffect(
  onViewportFocusEventChange: ((eventId: string | null) => void) | undefined,
  viewportFocusEventId: string | null,
) {
  useEffect(() => {
    onViewportFocusEventChange?.(viewportFocusEventId);
  }, [onViewportFocusEventChange, viewportFocusEventId]);
}
