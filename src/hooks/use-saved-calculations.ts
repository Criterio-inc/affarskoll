"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SavedCalculation } from "@/types/savedCalculation";

export function useSavedCalculations() {
  return useQuery<SavedCalculation[]>({
    queryKey: ["saved-calculations"],
    queryFn: async () => {
      const res = await fetch("/api/saved-calculations");
      if (!res.ok) throw new Error("Kunde inte ladda sparade beräkningar");
      return res.json();
    },
  });
}

export function useCreateSavedCalculation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (calc: Omit<SavedCalculation, "id">) => {
      const res = await fetch("/api/saved-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calc),
      });
      if (!res.ok) throw new Error("Kunde inte spara beräkning");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-calculations"] });
    },
  });
}

export function useDeleteSavedCalculation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved-calculations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte ta bort beräkning");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-calculations"] });
    },
  });
}
