"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Kunde inte ladda inställningar");
      const data = await res.json();
      return (data.settings ?? DEFAULT_SETTINGS) as AppSettings;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: AppSettings) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("Kunde inte spara inställningar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
