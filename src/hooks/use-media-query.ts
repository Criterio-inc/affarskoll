"use client";

import { useEffect, useState } from "react";

/**
 * Returnerar true när media-frågan matchar. SSR-säker: utgår från false tills
 * komponenten monterats i webbläsaren (undviker hydration-mismatch).
 *
 * Exempel: const isMobile = useMediaQuery("(max-width: 639px)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
