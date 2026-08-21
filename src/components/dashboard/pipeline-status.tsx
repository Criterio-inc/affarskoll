"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types/project";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  aktiv: {
    label: "Aktiva",
    color: "bg-success",
    bgColor:
      "bg-success/15 text-success",
  },
  prospekt: {
    label: "Prospekt",
    color: "bg-yellow-500",
    bgColor:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  avslutad: {
    label: "Avslutade",
    color: "bg-gray-400",
    bgColor: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
  arkiverad: {
    label: "Arkiverade",
    color: "bg-gray-300",
    bgColor: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500",
  },
};

const PIPELINE_CONFIG: Record<string, { label: string; color: string }> = {
  "förfrågan": {
    label: "Förfrågan",
    color:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "förhandling": {
    label: "Förhandling",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  "vunnen": {
    label: "Vunnen",
    color:
      "bg-success/15 text-success",
  },
  "förlorad": {
    label: "Förlorad",
    color:
      "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

interface PipelineStatusWidgetProps {
  projects: Project[];
}

/** Estimate project revenue potential. Used for pipeline value summation. */
function estimateProjectValue(project: Project): number {
  const contractType = project.contractType;
  const fixed = Number(project.fixedPrice ?? 0);
  const rate = Number(project.hourlyRate ?? 0);
  const hours = Number(project.budgetedHours ?? 0);

  if (contractType === "fastpris" || contractType === "fastpris_overtid") {
    return fixed;
  }
  if (contractType === "timpris") {
    return hours * rate;
  }
  if (contractType === "blandat") {
    return fixed + hours * rate;
  }
  return 0;
}

export function PipelineStatusWidget({ projects }: PipelineStatusWidgetProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    for (const project of projects) {
      const status = project.status || "prospekt";
      if (!groups[status]) groups[status] = [];
      groups[status].push(project);
    }
    return groups;
  }, [projects]);

  // Fas 2.2: total pipeline value + active value
  const pipelineValue = useMemo(() => {
    return (grouped.prospekt ?? []).reduce(
      (sum, p) => sum + estimateProjectValue(p),
      0
    );
  }, [grouped.prospekt]);

  const activeValue = useMemo(() => {
    return (grouped.aktiv ?? []).reduce(
      (sum, p) => sum + estimateProjectValue(p),
      0
    );
  }, [grouped.aktiv]);

  // Fas 2.1: sub-grouping by pipelineStatus
  const prospektByPipeline = useMemo(() => {
    const byStatus: Record<string, Project[]> = {
      "förfrågan": [],
      "förhandling": [],
      "vunnen": [],
      "förlorad": [],
    };
    for (const p of grouped.prospekt ?? []) {
      const key = (p.pipelineStatus as string) || "förfrågan";
      if (!byStatus[key]) byStatus[key] = [];
      byStatus[key].push(p);
    }
    return byStatus;
  }, [grouped.prospekt]);

  const totalProjects = projects.length;
  const displayOrder = ["aktiv", "prospekt", "avslutad", "arkiverad"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Pipeline-status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {displayOrder.map((status) => {
            const count = grouped[status]?.length ?? 0;
            if (count === 0) return null;
            const config = STATUS_CONFIG[status];
            return (
              <Badge key={status} variant="outline" className={config?.bgColor}>
                {config?.label}: {count}
              </Badge>
            );
          })}
        </div>

        {/* Value summary (Fas 2.2) */}
        {(pipelineValue > 0 || activeValue > 0) && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {activeValue > 0 && (
              <div className="rounded-md border bg-success/5 p-2">
                <p className="text-xs text-muted-foreground">Aktivt värde</p>
                <p className="text-sm font-semibold text-success">
                  {formatCurrency(activeValue)}
                </p>
              </div>
            )}
            {pipelineValue > 0 && (
              <div className="rounded-md border bg-yellow-500/5 p-2">
                <p className="text-xs text-muted-foreground">Pipeline-värde</p>
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                  {formatCurrency(pipelineValue)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bar chart */}
        {totalProjects > 0 && (
          <div className="space-y-2">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              {displayOrder.map((status) => {
                const count = grouped[status]?.length ?? 0;
                if (count === 0) return null;
                const pct = (count / totalProjects) * 100;
                const config = STATUS_CONFIG[status];
                return (
                  <div
                    key={status}
                    className={`${config?.color} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                    title={`${config?.label}: ${count} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {displayOrder.map((status) => {
                const count = grouped[status]?.length ?? 0;
                if (count === 0) return null;
                const config = STATUS_CONFIG[status];
                return (
                  <div key={status} className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${config?.color}`}
                    />
                    <span>
                      {config?.label} ({count})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-status project list */}
        <div className="space-y-3 pt-1">
          {displayOrder.map((status) => {
            const statusProjects = grouped[status];
            if (!statusProjects || statusProjects.length === 0) return null;
            const config = STATUS_CONFIG[status];

            // Special rendering for prospekt: sub-group by pipelineStatus (Fas 2.1)
            if (status === "prospekt") {
              return (
                <div key={status}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {config?.label}
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(prospektByPipeline).map(([pStatus, list]) => {
                      if (list.length === 0) return null;
                      const pConfig = PIPELINE_CONFIG[pStatus];
                      return (
                        <div key={pStatus}>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${pConfig?.color}`}
                            >
                              {pConfig?.label ?? pStatus}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({list.length})
                            </span>
                          </div>
                          <ul className="space-y-1 ml-1">
                            {list.map((project) => (
                              <li
                                key={project.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="truncate min-w-0 pr-2">
                                  {project.title}
                                </span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                  {project.customerName}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div key={status}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {config?.label}
                </h4>
                <ul className="space-y-1">
                  {statusProjects.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate min-w-0 pr-2">{project.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {project.customerName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {totalProjects === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Inga uppdrag att visa
          </p>
        )}
      </CardContent>
    </Card>
  );
}
