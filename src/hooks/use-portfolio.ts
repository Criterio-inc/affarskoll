"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortfolioAssignment } from "@/types/portfolio";
import { useProjects } from "./use-projects";
import {
  mergePortfolioWithProjects,
  type SyncedPortfolioResult,
} from "@/lib/portfolio-sync";

export function usePortfolio() {
  return useQuery<PortfolioAssignment[]>({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Kunde inte ladda portfölj");
      const data = await res.json();
      return (data.assignments ?? []) as PortfolioAssignment[];
    },
  });
}

/**
 * Fas 4.2 + 4.3: Synced portfolio — merges saved manual entries with live project data.
 * Detects drift between saved portfolio snapshots and their source projects.
 */
export function useSyncedPortfolio(options: { includeProspekt?: boolean } = {}): SyncedPortfolioResult & {
  isLoading: boolean;
  saved: PortfolioAssignment[];
} {
  const { data: saved = [], isLoading: portfolioLoading } = usePortfolio();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const synced = useMemo(
    () => mergePortfolioWithProjects(saved, projects as unknown as Parameters<typeof mergePortfolioWithProjects>[1], options),
    [saved, projects, options.includeProspekt]
  );

  return {
    ...synced,
    saved,
    isLoading: portfolioLoading || projectsLoading,
  };
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignments: PortfolioAssignment[]) => {
      const res = await fetch("/api/portfolio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error("Kunde inte spara portfölj");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}
