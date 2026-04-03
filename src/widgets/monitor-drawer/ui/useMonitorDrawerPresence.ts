import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from "react";

const DRAWER_EXIT_DURATION_MS = 320;
type DrawerPresencePhase = "open" | "closed";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function openDrawerPresence(
  setMounted: Dispatch<SetStateAction<boolean>>,
  setPhase: Dispatch<SetStateAction<DrawerPresencePhase>>,
) {
  setMounted(true);
  const frameId = window.requestAnimationFrame(() => {
    setPhase("open");
  });
  return () => window.cancelAnimationFrame(frameId);
}

function closeDrawerPresence(
  mounted: boolean,
  setMounted: Dispatch<SetStateAction<boolean>>,
  setPhase: Dispatch<SetStateAction<DrawerPresencePhase>>,
) {
  setPhase("closed");
  if (!mounted || prefersReducedMotion()) {
    setMounted(false);
    return undefined;
  }

  const timeoutId = window.setTimeout(() => {
    setMounted(false);
  }, DRAWER_EXIT_DURATION_MS);

  return () => window.clearTimeout(timeoutId);
}

export function useMonitorDrawerPresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<DrawerPresencePhase>(
    open ? "open" : "closed",
  );

  useEffect(() => {
    return open
      ? openDrawerPresence(setMounted, setPhase)
      : closeDrawerPresence(mounted, setMounted, setPhase);
  }, [mounted, open]);

  return { mounted, phase };
}
