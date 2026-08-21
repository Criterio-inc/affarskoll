"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TimesheetEntryTemplate {
  projectId: string;
  dayOffset: number;       // 0 = Monday, 4 = Friday
  hours: number;
  category: string;
  description: string;
  isBillable: boolean;
  workPackageId?: string;
}

export interface TimesheetTemplate {
  id: string;
  userId: string;
  name: string;
  entries: TimesheetEntryTemplate[];
  createdAt: string;
}

export function useTimesheetTemplates() {
  return useQuery<TimesheetTemplate[]>({
    queryKey: ["timesheet-templates"],
    queryFn: async () => {
      const res = await fetch("/api/timesheet-templates");
      if (!res.ok) throw new Error("Kunde inte ladda vecko-mallar");
      return res.json();
    },
  });
}

export function useCreateTimesheetTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      entries: TimesheetEntryTemplate[];
    }) => {
      const res = await fetch("/api/timesheet-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte spara vecko-mall");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet-templates"] }),
  });
}

export function useDeleteTimesheetTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/timesheet-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte ta bort mall");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet-templates"] }),
  });
}
