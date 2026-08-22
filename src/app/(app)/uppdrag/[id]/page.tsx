"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Plus,
  AlertTriangle,
  Loader2,
  Briefcase,
  FolderDown,
  TrendingUp,
  BookmarkPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useProject, useDeleteProject } from "@/hooks/use-projects";
import { useCreateProjectTemplate } from "@/hooks/use-project-templates";
import { usePortfolio, useUpdatePortfolio } from "@/hooks/use-portfolio";
import { useSettings } from "@/hooks/use-settings";
import { PortfolioAssignment } from "@/types/portfolio";
import { getSafeSettings } from "@/lib/settings";
import {
  calculateTotalValue,
  calculateNetAfterCommission,
  formatCurrency,
} from "@/lib/utils";
import { projectEarnedRevenue } from "@/lib/revenue";
import {
  useTimeEntries,
  useCreateTimeEntry,
  useDeleteTimeEntry,
  type TimeEntry,
} from "@/hooks/use-time-entries";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CONTRACT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PIPELINE_STATUS_LABELS,
  WORK_CATEGORY_LABELS,
  WORKPLACE_TYPE_LABELS,
  type WorkplaceType,
  type ContractType,
  type ProjectStatus,
  type PipelineStatus,
  type WorkCategory,
  type WorkPackage,
  type ProjectPhase,
} from "@/types/project";

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
    month: "long",
    day: "numeric",
  });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: project, isLoading, error } = useProject(id);
  const { data: allTimeEntries } = useTimeEntries();
  const { data: portfolioAssignments = [] } = usePortfolio();
  const updatePortfolio = useUpdatePortfolio();
  const { data: settingsData } = useSettings();
  const safeSettings = getSafeSettings(settingsData);
  const deleteProject = useDeleteProject();
  const createTemplate = useCreateProjectTemplate();
  const createTimeEntry = useCreateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();

  const [activeTab, setActiveTab] = useState("oversikt");
  const [showAddTimeEntry, setShowAddTimeEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    hours: "",
    category: "ovrigt" as WorkCategory,
    description: "",
    workPackageId: "",
    isBillable: true,
  });

  // Filter time entries for this project
  const projectEntries = useMemo(() => {
    if (!allTimeEntries) return [];
    return allTimeEntries.filter((e: TimeEntry) => e.projectId === id);
  }, [allTimeEntries, id]);

  // Calculate totals
  const totalUsedHours = useMemo(() => {
    return projectEntries.reduce(
      (sum: number, e: TimeEntry) => sum + Number(e.hours),
      0
    );
  }, [projectEntries]);

  const budgetedHours = Number(project?.budgetedHours ?? 0);
  const progressPercent =
    budgetedHours > 0
      ? Math.min((totalUsedHours / budgetedHours) * 100, 100)
      : 0;
  const budgetWarning80 = budgetedHours > 0 && progressPercent >= 80;
  const budgetWarning90 = budgetedHours > 0 && progressPercent >= 90;

  // Work packages with used hours
  const workPackagesWithHours = useMemo(() => {
    if (!project?.workPackages) return [];
    const wpList = project.workPackages as WorkPackage[];
    return wpList.map((wp) => {
      const wpEntries = projectEntries.filter(
        (e: TimeEntry) => e.workPackageId === wp.id
      );
      const usedHours = wpEntries.reduce(
        (sum: number, e: TimeEntry) => sum + Number(e.hours),
        0
      );
      return { ...wp, usedHours };
    });
  }, [project?.workPackages, projectEntries]);

  // Phases
  const phases = useMemo(() => {
    if (!project?.phases) return [];
    return project.phases as ProjectPhase[];
  }, [project?.phases]);

  // Fas 6.2: Profitability breakdown per project
  const profitability = useMemo(() => {
    if (!project) return null;
    const settings = getSafeSettings(settingsData ?? null);

    const billableHours = projectEntries
      .filter(
        (e: TimeEntry) =>
          e.isBillable !== false && e.category !== "ej_debiterbar"
      )
      .reduce((s: number, e: TimeEntry) => s + Number(e.hours), 0);

    // Revenue (intjänad total): fastpris fullt, övertid räknas — delad modell.
    const revenue = projectEarnedRevenue(project, {
      total: totalUsedHours,
      billable: billableHours,
    });

    // Provision (förmedling) — dras inte av om uppdraget är undantaget
    const commission =
      revenue * (project.brokerCommissionExempt ? 0 : settings.brokerCommissionRate);
    const netRevenue = revenue - commission;

    // Direct labor cost at consultant rate (salary + employer tax per hour)
    const monthlyLaborCost =
      settings.monthlySalaryGross * (1 + settings.employerTaxRate);
    const targetMonthlyHours = settings.targetWeeklyHours * 4.33;
    const laborCostPerHour =
      targetMonthlyHours > 0 ? monthlyLaborCost / targetMonthlyHours : 0;
    const laborCost = totalUsedHours * laborCostPerHour;

    // Allocated overhead based on project duration in months
    let overheadCost = 0;
    try {
      const s = parseISO(project.startDate);
      const e = parseISO(project.endDate);
      const days = Math.max(1, differenceInCalendarDays(e, s) + 1);
      const months = days / 30;
      overheadCost =
        (settings.monthlyOverhead + settings.brokerMonthlyFee) * months;
    } catch {
      /* ignore */
    }

    const totalCost = laborCost + overheadCost;
    const netProfit = netRevenue - totalCost;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      billableHours,
      revenue,
      commission,
      netRevenue,
      laborCost,
      laborCostPerHour,
      overheadCost,
      totalCost,
      netProfit,
      margin,
    };
  }, [project, projectEntries, settingsData, totalUsedHours, budgetedHours]);

  async function handleDeleteProject() {
    try {
      await deleteProject.mutateAsync(id);
      toast.success("Uppdraget har tagits bort");
      router.push("/uppdrag");
    } catch {
      toast.error("Kunde inte ta bort uppdraget");
    }
  }

  async function handleMoveToPortfolio() {
    if (!project) return;
    try {
      // Map project phases to portfolio format
      const projectPhases = (project.phases as ProjectPhase[]) || [];
      const portfolioPhases = projectPhases.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        hours: p.hours,
        allocationPercentage: p.allocationPercentage,
      }));

      const newAssignment: PortfolioAssignment = {
        id: crypto.randomUUID(),
        name: project.title,
        customerName: project.customerName,
        startDate: project.startDate,
        endDate: project.endDate,
        contractType: project.contractType as ContractType,
        fixedPrice: project.fixedPrice ? Number(project.fixedPrice) : undefined,
        hourlyRate: project.hourlyRate ? Number(project.hourlyRate) : undefined,
        hours: Number(project.budgetedHours),
        isFromSystem: false,
        distributionMode: portfolioPhases.length > 0 ? "phases" : "even",
        phases: portfolioPhases.length > 0 ? portfolioPhases : [],
      };

      // Remove any existing linked portfolio entry for this project, then add the new one
      const filteredAssignments = portfolioAssignments.filter(
        (a) => a.projectId !== id
      );
      await updatePortfolio.mutateAsync([...filteredAssignments, newAssignment]);

      // Delete the project from uppdrag
      await deleteProject.mutateAsync(id);

      toast.success("Uppdraget har flyttats till portföljen");
      router.push("/ekonomi/kalkyl");
    } catch {
      toast.error("Kunde inte flytta uppdraget till portföljen");
    }
  }

  async function handleSaveAsTemplate() {
    if (!project) return;
    const name = window.prompt(
      "Namnge mallen:",
      `Mall: ${project.title}`
    );
    if (!name) return;

    const templateData: Record<string, unknown> = {
      title: project.title,
      contractType: project.contractType,
      budgetedHours: Number(project.budgetedHours ?? 0),
      hourlyRate: project.hourlyRate ? Number(project.hourlyRate) : null,
      fixedPrice: project.fixedPrice ? Number(project.fixedPrice) : null,
      plannedHoursPerWeek: project.plannedHoursPerWeek
        ? Number(project.plannedHoursPerWeek)
        : null,
      workPackages: project.workPackages ?? [],
      phases: project.phases ?? [],
      usePhaseDistribution: project.usePhaseDistribution ?? false,
      notes: project.notes ?? "",
      billingDate: project.billingDate ?? null,
    };

    try {
      await createTemplate.mutateAsync({ name, templateData });
      toast.success("Sparad som mall");
    } catch {
      toast.error("Kunde inte spara mall");
    }
  }

  async function handleAddTimeEntry() {
    if (!newEntry.hours || parseFloat(newEntry.hours) <= 0) {
      toast.error("Ange giltiga timmar");
      return;
    }
    try {
      await createTimeEntry.mutateAsync({
        projectId: id,
        date: newEntry.date,
        hours: newEntry.hours,
        category: newEntry.category,
        description: newEntry.description || "",
        workPackageId: newEntry.workPackageId || null,
        isBillable: newEntry.isBillable,
      } as any);
      toast.success("Tidspost tillagd");
      setShowAddTimeEntry(false);
      setNewEntry({
        date: new Date().toISOString().split("T")[0],
        hours: "",
        category: "ovrigt",
        description: "",
        workPackageId: "",
        isBillable: true,
      });
    } catch {
      toast.error("Kunde inte lägga till tidspost");
    }
  }

  async function handleDeleteTimeEntry(entryId: string) {
    try {
      await deleteTimeEntry.mutateAsync(entryId);
      toast.success("Tidspost borttagen");
    } catch {
      toast.error("Kunde inte ta bort tidspost");
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/uppdrag">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Link>
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">
              Kunde inte ladda uppdraget. Det kanske inte finns eller sa har du
              inte behörighet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/uppdrag">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {project.title}
              </h1>
              <Badge variant={getStatusBadgeVariant(project.status)}>
                {PROJECT_STATUS_LABELS[project.status as ProjectStatus] ||
                  project.status}
              </Badge>
              {project.status === "prospekt" && project.pipelineStatus && (
                <Badge variant="outline">
                  {PIPELINE_STATUS_LABELS[
                    project.pipelineStatus as PipelineStatus
                  ] || project.pipelineStatus}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {project.customerName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAsTemplate}
            disabled={createTemplate.isPending}
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Spara som mall
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={updatePortfolio.isPending || deleteProject.isPending}
              >
                <FolderDown className="h-4 w-4 mr-2" />
                Till portfölj
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Flytta till portfölj?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Uppdraget &quot;{project.title}&quot; kommer att flyttas till portföljen
                  i kalkylatorn.{" "}
                  {projectEntries.length > 0
                    ? `${projectEntries.length} tidspost(er) kopplade till uppdraget kommer att tas bort.`
                    : "Uppdraget tas bort från uppdragslistan."}
                  {" "}Du kan sedan lyfta det till ett prospekt igen vid behov.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleMoveToPortfolio}>
                  Flytta till portfölj
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/uppdrag/${id}/redigera`}>
              <Pencil className="h-4 w-4 mr-2" />
              Redigera
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Ta bort
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Ta bort uppdrag?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Är du säker på att du vill ta bort &quot;{project.title}&quot;?
                  Alla tidsposter kopplade till uppdraget kommer också tas bort.
                  Denna åtgärd kan inte ångras.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Ta bort
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Budget warnings (FIX F4) */}
      {budgetWarning90 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-destructive">
                Budgetvarning: 90% av budgeten förbrukad
              </p>
              <p className="text-sm text-destructive/80">
                {totalUsedHours.toFixed(1)} av {budgetedHours} timmar använda (
                {progressPercent.toFixed(0)}%)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {budgetWarning80 && !budgetWarning90 && (
        <Card className="border-yellow-500 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">
                Budgetvarning: 80% av budgeten förbrukad
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                {totalUsedHours.toFixed(1)} av {budgetedHours} timmar använda (
                {progressPercent.toFixed(0)}%)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="oversikt">Översikt</TabsTrigger>
          <TabsTrigger value="arbetspaket">Arbetspaket</TabsTrigger>
          <TabsTrigger value="tidsregistrering">Tidsregistrering</TabsTrigger>
          <TabsTrigger value="faser">Faser</TabsTrigger>
        </TabsList>

        {/* Oversikt tab */}
        <TabsContent value="oversikt" className="space-y-6">
          {/* Progress summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Framsteg</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Använda timmar</span>
                <span className="font-semibold">
                  {totalUsedHours.toFixed(1)} / {budgetedHours} h
                </span>
              </div>
              <Progress
                value={progressPercent}
                className={`h-3 ${
                  progressPercent >= 90
                    ? "[&>div]:bg-destructive"
                    : progressPercent >= 80
                    ? "[&>div]:bg-yellow-500"
                    : ""
                }`}
              />
              <p className="text-xs text-muted-foreground text-right">
                {(budgetedHours - totalUsedHours).toFixed(1)} timmar kvar
              </p>
            </CardContent>
          </Card>

          {/* Info cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dates */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Datum</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Startdatum</span>
                  <span>{formatDate(project.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slutdatum</span>
                  <span>{formatDate(project.endDate)}</span>
                </div>
                {project.plannedHoursPerWeek && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timmar/vecka</span>
                    <span>
                      {Number(project.plannedHoursPerWeek).toFixed(0)} h
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Arbetsställe / tjänsteställe */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Arbetsställe / tjänsteställe
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Läge</span>
                  <span className="text-right">
                    {WORKPLACE_TYPE_LABELS[
                      (project.workplaceType as WorkplaceType) ?? "distans"
                    ]}
                  </span>
                </div>
                {project.workplaceType === "blandat" &&
                  project.workplaceSharePct != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Andel på plats
                      </span>
                      <span>~{project.workplaceSharePct} %</span>
                    </div>
                  )}
                {project.workplaceType === "pa_plats" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Tjänsteställe hos kunden — resor dit ger normalt ingen
                    skattefri milersättning.
                  </p>
                )}
                {project.workplaceNote && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t pt-2">
                    {project.workplaceNote}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Budget & rates */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Budget & Prissättning
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avtalstyp</span>
                  <span>
                    {CONTRACT_TYPE_LABELS[
                      project.contractType as ContractType
                    ] || project.contractType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Budgeterade timmar
                  </span>
                  <span>{budgetedHours} h</span>
                </div>
                {project.hourlyRate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timpris</span>
                    <span>
                      {formatCurrency(Number(project.hourlyRate))}/h
                    </span>
                  </div>
                )}
                {project.fixedPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fast pris</span>
                    <span>
                      {formatCurrency(Number(project.fixedPrice))}
                    </span>
                  </div>
                )}
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
                    <>
                      <div className="border-t my-2" />
                      <div className="flex justify-between font-medium">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          Uppdragsvärde
                        </span>
                        <span className="text-primary">{formatCurrency(totalVal)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Netto efter provision</span>
                        <span className={netAfterCommission >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(Math.round(netAfterCommission))}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Fas 6.2: Profitability */}
          {profitability && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Lönsamhet (hittills)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Debiterbara timmar</span>
                  <span>{profitability.billableHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bruttointäkt</span>
                  <span>{formatCurrency(profitability.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-600">
                  <span>&minus; Förmedlingsprovision</span>
                  <span>&minus;{formatCurrency(profitability.commission)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-600">
                  <span>&minus; Arbetskostnad ({Math.round(profitability.laborCostPerHour)}/h)</span>
                  <span>&minus;{formatCurrency(profitability.laborCost)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-600">
                  <span>&minus; Allokerad overhead</span>
                  <span>&minus;{formatCurrency(profitability.overheadCost)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Nettovinst</span>
                  <span
                    className={
                      profitability.netProfit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {formatCurrency(profitability.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vinstmarginal</span>
                  <span
                    className={
                      profitability.margin >= 0
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {profitability.margin.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {project.notes && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Anteckningar
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Arbetspaket tab */}
        <TabsContent value="arbetspaket" className="space-y-4">
          {workPackagesWithHours.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">Inga arbetspaket</h3>
                <p className="text-sm text-muted-foreground">
                  Lägg till arbetspaket via redigera-sidan för att dela upp
                  uppdraget.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-3 font-medium">
                          Arbetspaket
                        </th>
                        <th className="text-right pb-3 font-medium">
                          Allokerat
                        </th>
                        <th className="text-right pb-3 font-medium">
                          Använt
                        </th>
                        <th className="text-right pb-3 font-medium hidden sm:table-cell">Kvar</th>
                        <th className="pb-3 font-medium w-40 hidden md:table-cell">Framsteg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {workPackagesWithHours.map((wp) => {
                        const pct =
                          wp.allocatedHours > 0
                            ? Math.min(
                                (wp.usedHours / wp.allocatedHours) * 100,
                                100
                              )
                            : 0;
                        return (
                          <tr key={wp.id}>
                            <td className="py-3 font-medium">{wp.name}</td>
                            <td className="py-3 text-right">
                              {wp.allocatedHours} h
                            </td>
                            <td className="py-3 text-right">
                              {wp.usedHours.toFixed(1)} h
                            </td>
                            <td className="py-3 text-right hidden sm:table-cell">
                              {(wp.allocatedHours - wp.usedHours).toFixed(1)} h
                            </td>
                            <td className="py-3 hidden md:table-cell">
                              <Progress
                                value={pct}
                                className={`h-2 ${
                                  pct >= 90
                                    ? "[&>div]:bg-destructive"
                                    : pct >= 80
                                    ? "[&>div]:bg-yellow-500"
                                    : ""
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td className="pt-3">Totalt</td>
                        <td className="pt-3 text-right">
                          {workPackagesWithHours
                            .reduce((s, w) => s + w.allocatedHours, 0)
                            .toFixed(0)}{" "}
                          h
                        </td>
                        <td className="pt-3 text-right">
                          {workPackagesWithHours
                            .reduce((s, w) => s + w.usedHours, 0)
                            .toFixed(1)}{" "}
                          h
                        </td>
                        <td className="pt-3 text-right hidden sm:table-cell">
                          {workPackagesWithHours
                            .reduce(
                              (s, w) => s + (w.allocatedHours - w.usedHours),
                              0
                            )
                            .toFixed(1)}{" "}
                          h
                        </td>
                        <td className="hidden md:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tidsregistrering tab */}
        <TabsContent value="tidsregistrering" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Tidsposter</h3>
            <Button size="sm" onClick={() => setShowAddTimeEntry(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Lägg till tid
            </Button>
          </div>

          {projectEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">Inga tidsposter</h3>
                <p className="text-sm text-muted-foreground">
                  Börja registrera tid för detta uppdrag.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-3 font-medium">Datum</th>
                        <th className="text-right pb-3 font-medium">Timmar</th>
                        <th className="text-left pb-3 font-medium">
                          Kategori
                        </th>
                        <th className="text-left pb-3 font-medium hidden md:table-cell">
                          Beskrivning
                        </th>
                        <th className="text-center pb-3 font-medium hidden sm:table-cell">
                          Debiterbar
                        </th>
                        <th className="pb-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {projectEntries.map((entry: TimeEntry) => (
                        <tr key={entry.id}>
                          <td className="py-3">
                            {new Date(entry.date).toLocaleDateString("sv-SE")}
                          </td>
                          <td className="py-3 text-right font-medium">
                            {Number(entry.hours).toFixed(1)} h
                          </td>
                          <td className="py-3">
                            {WORK_CATEGORY_LABELS[
                              entry.category as WorkCategory
                            ] || entry.category}
                          </td>
                          <td className="py-3 text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                            {entry.description || "-"}
                          </td>
                          <td className="py-3 text-center hidden sm:table-cell">
                            {entry.isBillable ? (
                              <Badge variant="success" className="text-xs">
                                Ja
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Nej
                              </Badge>
                            )}
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTimeEntry(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td className="pt-3">Totalt</td>
                        <td className="pt-3 text-right">
                          {totalUsedHours.toFixed(1)} h
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Faser tab */}
        <TabsContent value="faser" className="space-y-4">
          {phases.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">Inga faser</h3>
                <p className="text-sm text-muted-foreground">
                  Lägg till faser via redigera-sidan för att planera uppdraget i
                  tidsperioder.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-3 font-medium">Fas</th>
                        <th className="text-left pb-3 font-medium">Period</th>
                        <th className="text-right pb-3 font-medium hidden sm:table-cell">
                          Omfattning
                        </th>
                        <th className="text-right pb-3 font-medium">
                          Timmar
                        </th>
                        <th className="text-left pb-3 font-medium hidden md:table-cell">
                          Beskrivning
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {phases.map((phase) => (
                        <tr key={phase.id}>
                          <td className="py-3 font-medium">{phase.name}</td>
                          <td className="py-3 text-muted-foreground">
                            {phase.startDate && phase.endDate
                              ? `${formatDate(phase.startDate)} - ${formatDate(
                                  phase.endDate
                                )}`
                              : "-"}
                          </td>
                          <td className="py-3 text-right hidden sm:table-cell">
                            {phase.allocationPercentage != null
                              ? `${phase.allocationPercentage}%`
                              : "-"}
                          </td>
                          <td className="py-3 text-right">{phase.hours} h</td>
                          <td className="py-3 text-muted-foreground hidden md:table-cell">
                            {phase.description || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td className="pt-3">Totalt</td>
                        <td />
                        <td className="hidden sm:table-cell" />
                        <td className="pt-3 text-right">
                          {phases.reduce((s, p) => s + p.hours, 0)} h
                        </td>
                        <td className="hidden md:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add time entry dialog */}
      <Dialog open={showAddTimeEntry} onOpenChange={setShowAddTimeEntry}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lägg till tidspost</DialogTitle>
            <DialogDescription>
              Registrera tid för {project.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="te-date">Datum</Label>
              <Input
                id="te-date"
                type="date"
                value={newEntry.date}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="te-hours">Timmar</Label>
              <Input
                id="te-hours"
                type="number"
                min="0"
                step="0.25"
                placeholder="t.ex. 8"
                value={newEntry.hours}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, hours: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={newEntry.category}
                onValueChange={(v) =>
                  setNewEntry({
                    ...newEntry,
                    category: v as WorkCategory,
                    isBillable: v !== "ej_debiterbar",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_CATEGORY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            {workPackagesWithHours.length > 0 && (
              <div className="space-y-2">
                <Label>Arbetspaket</Label>
                <Select
                  value={newEntry.workPackageId}
                  onValueChange={(v) =>
                    setNewEntry({ ...newEntry, workPackageId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj arbetspaket (valfritt)" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackagesWithHours.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id}>
                        {wp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="te-desc">Beskrivning</Label>
              <Textarea
                id="te-desc"
                placeholder="Vad gjorde du?"
                rows={2}
                value={newEntry.description}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newEntry.isBillable}
                onCheckedChange={(checked) =>
                  setNewEntry({ ...newEntry, isBillable: checked })
                }
              />
              <Label>Debiterbar tid</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddTimeEntry(false)}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleAddTimeEntry}
              disabled={createTimeEntry.isPending}
            >
              {createTimeEntry.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
