"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ProjectTemplate {
  id: string;
  userId: string;
  name: string;
  templateData: Record<string, unknown>;
  createdAt: string;
}

export function useProjectTemplates() {
  return useQuery<ProjectTemplate[]>({
    queryKey: ["project-templates"],
    queryFn: async () => {
      const res = await fetch("/api/project-templates");
      if (!res.ok) throw new Error("Kunde inte ladda mallar");
      return res.json();
    },
  });
}

export function useCreateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; templateData: Record<string, unknown> }) => {
      const res = await fetch("/api/project-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte spara mall");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-templates"] }),
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte ta bort mall");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-templates"] }),
  });
}
