"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/types/project";

export function TrashCard() {
  const qc = useQueryClient();

  const { data: deletedProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects", "deleted"],
    queryFn: async () => {
      const res = await fetch("/api/projects?deleted=1");
      if (!res.ok) throw new Error("Kunde inte ladda raderade uppdrag");
      return res.json();
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Kunde inte återställa");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", "deleted"] });
      toast.success("Uppdrag återställt");
    },
    onError: () => toast.error("Kunde inte återställa"),
  });

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}?hard=1`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte radera permanent");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", "deleted"] });
      toast.success("Permanent borttaget");
    },
    onError: () => toast.error("Kunde inte radera permanent"),
  });

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Papperskorg
        </CardTitle>
        <CardDescription>
          Borttagna uppdrag kan återställas härifrån. Inga uppdrag tas bort
          permanent automatiskt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Laddar...
          </div>
        ) : deletedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inga raderade uppdrag. Papperskorgen är tom.
          </p>
        ) : (
          <div className="space-y-2">
            {deletedProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border p-2 gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.customerName} · {p.startDate} – {p.endDate}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore.mutate(p.id)}
                    disabled={restore.isPending}
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    Återställ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (
                        confirm(
                          `Radera "${p.title}" permanent? Detta kan INTE ångras.`
                        )
                      ) {
                        hardDelete.mutate(p.id);
                      }
                    }}
                    disabled={hardDelete.isPending}
                    aria-label="Radera permanent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
