import { useEffect, useState } from "react";

const COMPACT_VIEWPORT_WIDTH = 720;

function isCompactViewport() {
  return typeof window !== "undefined" && window.innerWidth <= COMPACT_VIEWPORT_WIDTH;
}

export function useCompactViewport() {
  const [compactViewport, setCompactViewport] = useState(isCompactViewport);

  useEffect(() => {
    const handleResize = () => {
      setCompactViewport(isCompactViewport());
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return compactViewport;
}
