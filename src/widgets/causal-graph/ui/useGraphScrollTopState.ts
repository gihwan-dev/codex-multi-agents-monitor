import { useEffect, useRef, useState } from "react";

export function useGraphScrollTopState() {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollTopRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const scheduleScrollTopUpdate = (nextScrollTop: number) => {
    scrollTopRef.current = nextScrollTop;
    if (rafRef.current !== 0) {
      return;
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setScrollTop(scrollTopRef.current);
    });
  };

  return { scrollTop, scheduleScrollTopUpdate };
}
