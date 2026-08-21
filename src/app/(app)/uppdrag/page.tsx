"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Search,
  Calendar,
  Clock,
  ArrowRight,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import { useProjects, type Project } from "@/hooks/use-projects";
import { useTimeEntries, type TimeEntry } from "@/hooks/use-time-entries";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import { calculateTotalValue, calculateNetAfterCommission, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CONTRACT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PIPELINE_STATUS_LABELS,
  type ContractType,
  type ProjectStatus,
  type PipelineStatus,
} from "@/types/project";

type FilterTab = "alla" | "aktiv" | "prospekt" | "avslutad" | "arkiverad";

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" | "warning" | "success" {
  switch (status) {
    case "aktiv":
      return "success";
    case "prospekt":
      return "warning";
    case "avslutad":
      return "secondary";
    case "arkiverad":
      return "outline";
    default:
      return "default";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UppdragPage() {
  const { data: projects, isLoading, error } = useProjects();
  const { data: timeEntries } = useTimeEntries();
  const { data: settingsData } = useSettings();
  const safeSettings = getSafeSettings(settingsData);
  const [activeTab, setActiveTab] = useState<FilterTab>("alla");
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate used hours per project from time entries
  const usedHoursMap = useMemo(() => {
    if (!timeEntries) return new Map<string, number>();
    const map = new Map<string, number>();
    timeEntries.forEach((entry: TimeEntry) => {
      const current = map.get(entry.projectId) || 0;
      map.set(entry.projectId, current + Number(entry.hours));
    });
    return map;
  }, [timeEntries]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let filtered = [...projects];

    // Status filter
    if (activeTab !== "alla") {
      filtered = filtered.filter((p: Project) => p.status === activeTab);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p: Project) =>
          p.title.toLowerCase().includes(query) ||
          p.customerName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [projects, activeTab, searchQuery]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">
              Kunde inte ladda uppdrag. Försök igen senare.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Filter tabs and search */}
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as FilterTab)}
          >
            <TabsList className="w-max sm:w-auto">
              <TabsTrigger value="alla" className="text-xs sm:text-sm px-2 sm:px-3">Alla</TabsTrigger>
              <TabsTrigger value="aktiv" className="text-xs sm:text-sm px-2 sm:px-3">Aktiva</TabsTrigger>
              <TabsTrigger value="prospekt" className="text-xs sm:text-sm px-2 sm:px-3">Prospekt</TabsTrigger>
              <TabsTrigger value="avslutad" className="text-xs sm:text-sm px-2 sm:px-3">Avslutade</TabsTrigger>
              <TabsTrigger value="arkiverad" className="text-xs sm:text-sm px-2 sm:px-3">Arkiverade</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök uppdrag eller kund..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-2 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredProjects.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Inga uppdrag hittades</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? `Inga uppdrag matchar "${searchQuery}"`
                : activeTab !== "alla"
                ? `Inga ${
                    activeTab === "aktiv"
                      ? "aktiva"
                      : activeTab === "prospekt"
                      ? "prospekt"
                      : activeTab === "avslutad"
                      ? "avslutade"
                      : "arkiverade"
                  } uppdrag`
                : "Skapa ditt första uppdrag för att komma igång."}
            </p>
            {!searchQuery && activeTab === "alla" && (
              <Button asChild>
                <Link href="/uppdrag/nytt">
                  <Plus className="h-4 w-4 mr-2" />
                  Nytt uppdrag
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project cards grid */}
      {!isLoading && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project: Project) => {
            const budgetedHours = Number(project.budgetedHours);
            const usedHours = usedHoursMap.get(project.id) || 0;
            const progressPercent =
              budgetedHours > 0
                ? Math.min((usedHours / budgetedHours) * 100, 100)
                : 0;

            return (
              <Link
                key={project.id}
                href={`/uppdrag/${project.id}`}
                className="block group"
              >
                <Card className="h-full transition-shadow hover:shadow-md group-hover:border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold truncate">
                          {project.title}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {project.customerName}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={getStatusBadgeVariant(project.status)}>
                          {PROJECT_STATUS_LABELS[project.status as ProjectStatus] ||
                            project.status}
                        </Badge>
                        {project.status === "prospekt" &&
                          project.pipelineStatus && (
                            <Badge variant="outline" className="text-[10px]">
                              {PIPELINE_STATUS_LABELS[
                                project.pipelineStatus as PipelineStatus
                              ] || project.pipelineStatus}
                            </Badge>
                          )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Contract type */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {CONTRACT_TYPE_LABELS[
                          project.contractType as ContractType
                        ] || project.contractType}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {formatDate(project.startDate)} -{" "}
                        {formatDate(project.endDate)}
                      </span>
                    </div>

                    {/* Hours progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Timmar</span>
                        </div>
                        <span className="font-medium">
                          {usedHours.toFixed(1)} / {budgetedHours} h
                        </span>
                      </div>
                      <Progress
                        value={progressPercent}
                        className={`h-2 ${
                          progressPercent >= 90
                            ? "[&>div]:bg-destructive"
                            : progressPercent >= 80
                            ? "[&>div]:bg-yellow-500"
                            : ""
                        }`}
                      />
                    </div>

                    {/* Value display */}
                    {(() => {
                      const totalVal = calculateTotalValue(
                        project.contractType,
                        budgetedHours,
                        Number(project.hourlyRate ?? 0),
                        Number(project.fixedPrice ?? 0)
                      );
                      if (totalVal <= 0) return null;
                      const netAfterCommission = calculateNetAfterCommission(
                        totalVal,
                        project.brokerCommissionExempt
                          ? 0
                          : safeSettings.brokerCommissionRate,
                      );
                      return (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-primary" />
                            <span className="text-muted-foreground">Värde:</span>
                            <span className="font-medium text-primary">{formatCurrency(totalVal)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">Netto:</span>
                            <span className={`font-medium ${netAfterCommission >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(Math.round(netAfterCommission))}
                            </span>
                          </span>
                        </div>
                      );
                    })()}

                    {/* Arrow indicator */}
                    <div className="flex justify-end pt-1">
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Uppdrag</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hantera dina konsultuppdrag
        </p>
      </div>
      <Button asChild>
        <Link href="/uppdrag/nytt">
          <Plus className="h-4 w-4 mr-2" />
          Nytt uppdrag
        </Link>
      </Button>
    </div>
  );
}
