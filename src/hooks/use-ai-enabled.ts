"use client";

import { useQuery } from "@tanstack/react-query";

// Är AI-funktionerna påslagna på servern (ANTHROPIC_API_KEY satt)?
// Svaret ändras bara vid omdeploy, så det cachas för hela sessionen.
// Default false tills svaret kommit — AI-ytorna blinkar hellre in än ur.
export function useAiEnabled(): boolean {
  const { data } = useQuery<{ enabled: boolean }>({
    queryKey: ["ai-status"],
    queryFn: async () => {
      const res = await fetch("/api/ai/status");
      if (!res.ok) return { enabled: false };
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });
  return data?.enabled ?? false;
}
