"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TimeEntry } from "@/types/project";

export type { TimeEntry } from "@/types/project";

export function useTimeEntries() {
  return useQuery<TimeEntry[]>({
    queryKey: ["time-entries"],
    queryFn: async () => {
      const res = await fetch("/api/time-entries");
      if (!res.ok) throw new Error("Kunde inte ladda tidregistreringar");
      return res.json();
    },
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<TimeEntry, "id" | "createdAt">) => {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error("Kunde inte skapa tidspost");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TimeEntry> & { id: string }) => {
      const res = await fetch(`/api/time-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte uppdatera tidspost");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte ta bort tidspost");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
