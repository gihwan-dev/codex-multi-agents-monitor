import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useState,
} from "react";

const TREE_DISCLOSURE_DURATION_MS = 240;
type DisclosureState = "open" | "closed";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function openDisclosurePresence(
  setMounted: Dispatch<SetStateAction<boolean>>,
  setState: Dispatch<SetStateAction<DisclosureState>>,
) {
  setMounted(true);
  const frameId = window.requestAnimationFrame(() => {
    setState("open");
  });
  return () => window.cancelAnimationFrame(frameId);
}

function closeDisclosurePresence(
  mounted: boolean,
  setMounted: Dispatch<SetStateAction<boolean>>,
  setState: Dispatch<SetStateAction<DisclosureState>>,
) {
  setState("closed");
  if (!mounted || prefersReducedMotion()) {
    setMounted(false);
    return undefined;
  }

  const timeoutId = window.setTimeout(() => {
    setMounted(false);
  }, TREE_DISCLOSURE_DURATION_MS);

  return () => window.clearTimeout(timeoutId);
}

export function useExpandablePresence(expanded: boolean) {
  const [mounted, setMounted] = useState(expanded);
  const [state, setState] = useState<DisclosureState>(
    expanded ? "open" : "closed",
  );

  useEffect(() => {
    return expanded
      ? openDisclosurePresence(setMounted, setState)
      : closeDisclosurePresence(mounted, setMounted, setState);
  }, [expanded, mounted]);

  return { mounted, state };
}

export function scrollTreeItemIntoView(
  treeRef: RefObject<HTMLDivElement | null>,
  activeTreeId: string,
) {
  const target = treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${activeTreeId}"]`);
  target?.scrollIntoView({
    block: "nearest",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
