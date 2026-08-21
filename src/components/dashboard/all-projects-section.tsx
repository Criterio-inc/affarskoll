"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Project, TimeEntry } from "@/types/project";

const STATUS_BADGE_MAP: Record<string, "success" | "warning" | "default" | "destructive"> = {
  aktiv: "success",
  prospekt: "warning",
  avslutad: "default",
  arkiverad: "default",
};

const STATUS_LABELS: Record<string, string> = {
  aktiv: "Aktiv",
  prospekt: "Prospekt",
  avslutad: "Avslutad",
  arkiverad: "Arkiverad",
};

const CONTRACT_LABELS: Record<string, string> = {
  fastpris: "Fastpris",
  timpris: "Timpris",
  blandat: "Fast + Timpris",
  fastpris_overtid: "Fastpris med övertid",
};

interface AllProjectsSectionProps {
  projects: Project[];
  timeEntries: TimeEntry[];
}

function ProjectCard({
  project,
  hoursUsed,
}: {
  project: Project;
  hoursUsed: number;
}) {
  const budgeted = Number(project.budgetedHours) || 0;
  const progressPct = budgeted > 0 ? Math.min((hoursUsed / budgeted) * 100, 100) : 0;
  const isOverBudget = budgeted > 0 && hoursUsed > budgeted;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Link href={`/uppdrag/${project.id}`} className="block group">
      <Card className="transition-colors hover:border-primary/40 hover:shadow-md h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
              {project.title}
            </CardTitle>
            <StatusBadge status={STATUS_BADGE_MAP[project.status] ?? "default"}>
              {STATUS_LABELS[project.status] ?? project.status}
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {project.customerName}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Contract type */}
          <Badge variant="outline" className="text-xs">
            {CONTRACT_LABELS[project.contractType] ?? project.contractType}
          </Badge>

          {/* Hours progress */}
          {budgeted > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Timmar</span>
                <span className={isOverBudget ? "text-destructive font-medium" : ""}>
                  {hoursUsed.toFixed(1)} / {budgeted}h
                </span>
              </div>
              <Progress
                value={progressPct}
                className={`h-2 ${isOverBudget ? "[&>div]:bg-destructive" : ""}`}
              />
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(project.startDate)}</span>
            <span className="mx-1">-</span>
            <span>{formatDate(project.endDate)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AllProjectsSection({
  projects,
  timeEntries,
}: AllProjectsSectionProps) {
  const [activeTab, setActiveTab] = useState("alla");

  // Calculate hours used per project
  const hoursPerProject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of timeEntries) {
      const hours = Number(entry.hours) || 0;
      map[entry.projectId] = (map[entry.projectId] || 0) + hours;
    }
    return map;
  }, [timeEntries]);

  // Filter projects by status
  const filteredProjects = useMemo(() => {
    if (activeTab === "alla") return projects;
    if (activeTab === "aktiva") return projects.filter((p) => p.status === "aktiv");
    if (activeTab === "prospekt") return projects.filter((p) => p.status === "prospekt");
    if (activeTab === "avslutade")
      return projects.filter((p) => p.status === "avslutad" || p.status === "arkiverad");
    return projects;
  }, [projects, activeTab]);

  // Counts for tab labels
  const counts = useMemo(() => {
    const c = { alla: projects.length, aktiva: 0, prospekt: 0, avslutade: 0 };
    for (const p of projects) {
      if (p.status === "aktiv") c.aktiva++;
      else if (p.status === "prospekt") c.prospekt++;
      else if (p.status === "avslutad" || p.status === "arkiverad") c.avslutade++;
    }
    return c;
  }, [projects]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Alla uppdrag</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="alla" className="text-xs sm:text-sm px-2 sm:px-3">Alla ({counts.alla})</TabsTrigger>
            <TabsTrigger value="aktiva" className="text-xs sm:text-sm px-2 sm:px-3">Aktiva ({counts.aktiva})</TabsTrigger>
            <TabsTrigger value="prospekt" className="text-xs sm:text-sm px-2 sm:px-3">Prospekt ({counts.prospekt})</TabsTrigger>
            <TabsTrigger value="avslutade" className="text-xs sm:text-sm px-2 sm:px-3">Avslutade ({counts.avslutade})</TabsTrigger>
          </TabsList>
        </div>

        {/* All tabs render the same filtered grid */}
        {["alla", "aktiva", "prospekt", "avslutade"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Inga uppdrag att visa
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    hoursUsed={hoursPerProject[project.id] || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
