"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Calendar as CalendarIcon,
  Loader2,
  Target,
  Zap,
  Pencil,
  BookmarkPlus,
  BookOpen,
  Trash2,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  getISOWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  getDay,
  addMonths,
  subMonths,
} from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { useProjects, type Project } from "@/hooks/use-projects";
import {
  useTimeEntries,
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
  type TimeEntry,
} from "@/hooks/use-time-entries";
import { useSettings } from "@/hooks/use-settings";
import {
  useTimesheetTemplates,
  useCreateTimesheetTemplate,
  useDeleteTimesheetTemplate,
  type TimesheetEntryTemplate,
} from "@/hooks/use-timesheet-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  WORK_CATEGORY_LABELS,
  WORK_LOCATION_LABELS,
  type WorkCategory,
  type WorkLocation,
} from "@/types/project";
import { useTrips } from "@/hooks/use-trips";
import { TimeReportExportDialog } from "@/components/tidsrapportering/time-report-export";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const DAY_LABELS_SHORT = ["Må", "Ti", "On", "To", "Fr", "Lö", "Sö"];

function getWeekDays(weekStart: Date): Date[] {
  return eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });
}

function formatDateShort(d: Date): string {
  return format(d, "d MMM", { locale: sv });
}

function formatDateISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fmtHours(h: number): string {
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

export default function TidsrapporteringPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: timeEntries, isLoading: entriesLoading } = useTimeEntries();
  const createTimeEntry = useCreateTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const { data: settings } = useSettings();
  const { data: allTrips = [] } = useTrips();
  const { data: weekTemplates = [] } = useTimesheetTemplates();

  // Förifyll dagens arbetsställe: hos kund om det finns en resa till uppdraget
  // den dagen, annars hemma.
  const defaultLocationFor = (
    projectId: string,
    date: string
  ): WorkLocation =>
    allTrips.some((t) => t.projectId === projectId && t.date === date)
      ? "hos_kund"
      : "hemma";
  const createWeekTemplate = useCreateTimesheetTemplate();
  const deleteWeekTemplate = useDeleteTimesheetTemplate();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [viewMode, setViewMode] = useState<"vecka" | "manad">("vecka");
  const [monthDate, setMonthDate] = useState(new Date());

  // Quick log state (FIX F1)
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickDate, setQuickDate] = useState(formatDateISO(new Date()));
  const [quickHours, setQuickHours] = useState("");
  const [quickCategory, setQuickCategory] = useState<WorkCategory>("ovrigt");
  const [quickLocation, setQuickLocation] = useState<WorkLocation | null>(null);

  // Add time entry dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEntry, setNewEntry] = useState({
    projectId: "",
    date: formatDateISO(new Date()),
    hours: "",
    category: "ovrigt" as WorkCategory,
    description: "",
    workPackageId: "",
    isBillable: true,
    location: null as WorkLocation | null,
  });

  // Cell entries picker (when a cell aggregates multiple entries)
  const [cellSelection, setCellSelection] = useState<{
    projectId: string;
    date: string;
  } | null>(null);

  // Edit time entry dialog
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    hours: "",
    category: "ovrigt" as WorkCategory,
    description: "",
    isBillable: true,
    location: null as WorkLocation | null,
  });

  const weekDays = useMemo(
    () => getWeekDays(currentWeekStart),
    [currentWeekStart]
  );
  const weekNumber = getISOWeek(currentWeekStart);
  const targetWeeklyHours = settings?.targetWeeklyHours ?? 40;
  const workDaysPerWeek = settings?.workDaysPerWeek ?? 5;
  const dailyTargetHours = targetWeeklyHours / Math.max(1, workDaysPerWeek);

  // Active projects only (L5 fix - prospekt should not be loggable)
  const activeProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p: Project) => p.status === "aktiv");
  }, [projects]);

  // Build a map: projectId -> dayISO -> hours
  const weekEntryMap = useMemo(() => {
    if (!timeEntries) return new Map<string, Map<string, number>>();
    const map = new Map<string, Map<string, number>>();
    const weekStart = currentWeekStart;
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    timeEntries.forEach((entry: TimeEntry) => {
      const entryDate = parseISO(entry.date);
      if (entryDate >= weekStart && entryDate <= weekEnd) {
        if (!map.has(entry.projectId)) {
          map.set(entry.projectId, new Map());
        }
        const dayMap = map.get(entry.projectId)!;
        const dayKey = formatDateISO(entryDate);
        const current = dayMap.get(dayKey) || 0;
        dayMap.set(dayKey, current + Number(entry.hours));
      }
    });
    return map;
  }, [timeEntries, currentWeekStart]);

  // Projects that have entries this week
  const weekProjectIds = useMemo(() => {
    const ids = new Set<string>();
    weekEntryMap.forEach((_, projectId) => ids.add(projectId));
    // Also include active projects
    activeProjects.forEach((p: Project) => ids.add(p.id));
    return Array.from(ids);
  }, [weekEntryMap, activeProjects]);

  // Day totals
  const dayTotals = useMemo(() => {
    return weekDays.map((day) => {
      const dayKey = formatDateISO(day);
      let total = 0;
      weekEntryMap.forEach((dayMap) => {
        total += dayMap.get(dayKey) || 0;
      });
      return total;
    });
  }, [weekDays, weekEntryMap]);

  const weekTotal = dayTotals.reduce((s, d) => s + d, 0);

  // Monthly heat map data
  const monthHeatMap = useMemo(() => {
    if (!timeEntries || viewMode !== "manad") return new Map<string, number>();
    const map = new Map<string, number>();
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    timeEntries.forEach((entry: TimeEntry) => {
      const entryDate = parseISO(entry.date);
      if (entryDate >= mStart && entryDate <= mEnd) {
        const key = formatDateISO(entryDate);
        const current = map.get(key) || 0;
        map.set(key, current + Number(entry.hours));
      }
    });
    return map;
  }, [timeEntries, monthDate, viewMode]);

  // Navigate weeks
  function goToPreviousWeek() {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  }
  function goToNextWeek() {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  }
  function goToCurrentWeek() {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  // Quick log handler (FIX F1 - 2 clicks)
  async function handleQuickLog() {
    if (!quickProjectId || !quickHours || parseFloat(quickHours) <= 0) {
      toast.error("Välj projekt och ange timmar");
      return;
    }
    if (!quickDate) {
      toast.error("Ange datum");
      return;
    }
    try {
      await createTimeEntry.mutateAsync({
        projectId: quickProjectId,
        date: quickDate,
        hours: quickHours,
        category: quickCategory,
        description: "",
        isBillable: quickCategory !== "ej_debiterbar",
        location: quickLocation ?? defaultLocationFor(quickProjectId, quickDate),
      } as any);
      toast.success("Tid registrerad!");
      setQuickHours("");
      setQuickLocation(null);

      // E18: Synka aktuell vecka till loggdatumet så användaren ser posten
      const loggedDate = parseISO(quickDate);
      const targetWeekStart = startOfWeek(loggedDate, { weekStartsOn: 1 });
      if (targetWeekStart.getTime() !== currentWeekStart.getTime()) {
        setCurrentWeekStart(targetWeekStart);
      }
      // Och säkerställ att veckovyn är aktiv (inte månadsvy)
      if (viewMode !== "vecka") {
        setViewMode("vecka");
      }
    } catch {
      toast.error("Kunde inte registrera tid");
    }
  }

  // Open edit dialog for a specific entry
  function openEditDialog(entry: TimeEntry) {
    setEditEntry(entry);
    setEditForm({
      date: entry.date,
      hours: String(entry.hours),
      category: entry.category,
      description: entry.description || "",
      isBillable: entry.isBillable ?? true,
      location:
        entry.location ?? defaultLocationFor(entry.projectId, entry.date),
    });
    setCellSelection(null);
  }

  // Open cell selector or edit directly when only one entry exists
  function handleCellClick(projectId: string, dayKey: string) {
    if (!timeEntries) return;
    const entries = timeEntries.filter(
      (e: TimeEntry) => e.projectId === projectId && e.date === dayKey
    );
    if (entries.length === 0) return;
    if (entries.length === 1) {
      openEditDialog(entries[0]);
    } else {
      setCellSelection({ projectId, date: dayKey });
    }
  }

  async function handleSaveEdit() {
    if (!editEntry) return;
    if (!editForm.hours || parseFloat(editForm.hours) <= 0) {
      toast.error("Ange giltiga timmar");
      return;
    }
    if (!editForm.date) {
      toast.error("Ange datum");
      return;
    }
    try {
      await updateTimeEntry.mutateAsync({
        id: editEntry.id,
        date: editForm.date,
        hours: editForm.hours as unknown as number,
        category: editForm.category,
        description: editForm.description,
        isBillable: editForm.isBillable,
        location:
          editForm.location ??
          defaultLocationFor(editEntry.projectId, editForm.date),
      } as any);
      toast.success("Tidspost uppdaterad");
      setEditEntry(null);
    } catch {
      toast.error("Kunde inte uppdatera tidspost");
    }
  }

  async function handleDeleteEdit() {
    if (!editEntry) return;
    if (!confirm("Vill du ta bort denna tidspost?")) return;
    try {
      await deleteTimeEntry.mutateAsync(editEntry.id);
      toast.success("Tidspost borttagen");
      setEditEntry(null);
    } catch {
      toast.error("Kunde inte ta bort tidspost");
    }
  }

  // Entries currently selected in the cell picker
  const cellSelectionEntries = useMemo(() => {
    if (!cellSelection || !timeEntries) return [];
    if (cellSelection.date) {
      return timeEntries.filter(
        (e: TimeEntry) =>
          e.projectId === cellSelection.projectId &&
          e.date === cellSelection.date
      );
    }
    // No date set => show all entries for project in current week
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return timeEntries
      .filter((e: TimeEntry) => {
        if (e.projectId !== cellSelection.projectId) return false;
        const d = parseISO(e.date);
        return d >= currentWeekStart && d <= weekEnd;
      })
      .sort((a: TimeEntry, b: TimeEntry) => a.date.localeCompare(b.date));
  }, [cellSelection, timeEntries, currentWeekStart]);

  // Fas 5.5: Save current week as a reusable template
  async function handleSaveWeekAsTemplate() {
    if (!timeEntries) return;
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    const weekEntries = timeEntries.filter((e: TimeEntry) => {
      const d = parseISO(e.date);
      return d >= currentWeekStart && d <= weekEnd;
    });

    if (weekEntries.length === 0) {
      toast.error("Denna vecka har inga tidsposter att spara som mall");
      return;
    }

    const name = window.prompt("Namnge mall:", `Standardvecka v${weekNumber}`);
    if (!name) return;

    const templateEntries: TimesheetEntryTemplate[] = weekEntries.map((e: TimeEntry) => {
      const entryDate = parseISO(e.date);
      const dayOffset = Math.round(
        (entryDate.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        projectId: e.projectId,
        dayOffset,
        hours: Number(e.hours),
        category: e.category,
        description: e.description ?? "",
        isBillable: e.isBillable ?? true,
        workPackageId: e.workPackageId ?? undefined,
      };
    });

    try {
      await createWeekTemplate.mutateAsync({ name, entries: templateEntries });
      toast.success(`Mall "${name}" sparad (${templateEntries.length} poster)`);
    } catch {
      toast.error("Kunde inte spara mall");
    }
  }

  // Fas 5.5: Apply a saved week template to the current week
  async function handleApplyWeekTemplate(templateId: string) {
    const template = weekTemplates.find((t) => t.id === templateId);
    if (!template) return;

    let created = 0;
    for (const entry of template.entries) {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(newDate.getDate() + entry.dayOffset);

      try {
        await createTimeEntry.mutateAsync({
          projectId: entry.projectId,
          date: formatDateISO(newDate),
          hours: String(entry.hours),
          category: entry.category,
          description: entry.description || "",
          workPackageId: entry.workPackageId || null,
          isBillable: entry.isBillable,
        } as any);
        created++;
      } catch {
        /* skip */
      }
    }

    if (created > 0) {
      toast.success(`${created} tidsposter från mall "${template.name}" applicerade`);
    } else {
      toast.error("Kunde inte applicera mall");
    }
  }

  async function handleDeleteWeekTemplate(id: string, name: string) {
    if (!confirm(`Ta bort mallen "${name}"? Detta kan inte ångras.`)) return;
    try {
      await deleteWeekTemplate.mutateAsync(id);
      toast.success("Mall borttagen");
    } catch {
      toast.error("Kunde inte ta bort mall");
    }
  }

  // Copy previous week (FIX F3)
  async function handleCopyPreviousWeek() {
    if (!timeEntries) return;

    // A4: Varna om aktuell vecka redan har poster (skulle ge dubletter)
    if (weekTotal > 0) {
      if (
        !confirm(
          `Aktuell vecka har redan ${weekTotal.toFixed(
            1
          )}h registrerade. Vill du verkligen kopiera förra veckans poster ovanpå (kan ge dubbletter)?`
        )
      )
        return;
    }

    const prevWeekStart = subWeeks(currentWeekStart, 1);
    const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });

    const prevEntries = timeEntries.filter((e: TimeEntry) => {
      const d = parseISO(e.date);
      return d >= prevWeekStart && d <= prevWeekEnd;
    });

    if (prevEntries.length === 0) {
      toast.error("Inga poster att kopiera från förra veckan");
      return;
    }

    let created = 0;
    for (const entry of prevEntries) {
      const oldDate = parseISO(entry.date);
      const dayOffset = Math.round(
        (oldDate.getTime() - prevWeekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newDate = new Date(currentWeekStart);
      newDate.setDate(newDate.getDate() + dayOffset);

      try {
        await createTimeEntry.mutateAsync({
          projectId: entry.projectId,
          date: formatDateISO(newDate),
          hours: entry.hours,
          category: entry.category,
          description: entry.description || "",
          workPackageId: entry.workPackageId || null,
          isBillable: entry.isBillable ?? true,
        } as any);
        created++;
      } catch {
        // Continue with other entries
      }
    }

    if (created > 0) {
      toast.success(`${created} tidsposter kopierade från förra veckan`);
    } else {
      toast.error("Kunde inte kopiera någon tidspost");
    }
  }

  // Add entry from dialog
  async function handleAddEntry() {
    if (
      !newEntry.projectId ||
      !newEntry.hours ||
      parseFloat(newEntry.hours) <= 0
    ) {
      toast.error("Välj projekt och ange giltiga timmar");
      return;
    }
    try {
      await createTimeEntry.mutateAsync({
        projectId: newEntry.projectId,
        date: newEntry.date,
        hours: newEntry.hours,
        category: newEntry.category,
        description: newEntry.description || "",
        workPackageId: newEntry.workPackageId || null,
        isBillable: newEntry.isBillable,
        location:
          newEntry.location ??
          defaultLocationFor(newEntry.projectId, newEntry.date),
      } as any);
      toast.success("Tidspost tillagd");
      setShowAddDialog(false);
      setNewEntry({
        projectId: "",
        date: formatDateISO(new Date()),
        hours: "",
        category: "ovrigt",
        description: "",
        workPackageId: "",
        isBillable: true,
        location: null,
      });
    } catch {
      toast.error("Kunde inte lägga till tidspost");
    }
  }

  function getProjectName(projectId: string): string {
    const p = projects?.find((proj: Project) => proj.id === projectId);
    return p ? p.title : "Okänt projekt";
  }

  const isLoading = projectsLoading || entriesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tidsrapportering
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registrera och följ upp dina arbetstimmar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TimeReportExportDialog />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPreviousWeek}
            disabled={createTimeEntry.isPending}
          >
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Kopiera förra veckan</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveWeekAsTemplate}
            disabled={createWeekTemplate.isPending}
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Spara vecka som mall
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Ny tidspost</span>
          </Button>
        </div>
      </div>

      {/* Fas 5.5: week templates */}
      {weekTemplates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Vecko-mallar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {weekTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center gap-1 rounded-md border bg-muted/30 pr-1"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyWeekTemplate(tpl.id)}
                    className="px-3 py-1.5 text-sm font-medium hover:text-primary"
                  >
                    {tpl.name}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({tpl.entries.length})
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteWeekTemplate(tpl.id, tpl.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick log widget (FIX F1) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              Snabbregistrering
            </CardTitle>
          </div>
          <CardDescription>Registrera tid med två klick</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Projekt</Label>
            <Select value={quickProjectId} onValueChange={setQuickProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj projekt..." />
              </SelectTrigger>
              <SelectContent>
                {activeProjects.map((p: Project) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} ({p.customerName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Datum</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setQuickDate(formatDateISO(new Date()))}
              >
                Idag
              </button>
            </div>
            <Input
              type="date"
              value={quickDate}
              onChange={(e) => setQuickDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timmar</Label>
              <Input
                type="number"
                min="0"
                step="0.25"
                placeholder="8"
                value={quickHours}
                onChange={(e) => setQuickHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kategori</Label>
              <Select
                value={quickCategory}
                onValueChange={(v) => setQuickCategory(v as WorkCategory)}
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Arbetsställe</Label>
            <Select
              value={
                quickLocation ?? defaultLocationFor(quickProjectId, quickDate)
              }
              onValueChange={(v) => setQuickLocation(v as WorkLocation)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WORK_LOCATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={handleQuickLog}
            disabled={
              createTimeEntry.isPending ||
              !quickProjectId ||
              !quickHours ||
              !quickDate
            }
          >
            {createTimeEntry.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Logga
          </Button>
        </CardContent>
      </Card>

      {/* View mode toggle (FIX F6) */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as "vecka" | "manad")}
      >
        <TabsList>
          <TabsTrigger value="vecka">Veckovy</TabsTrigger>
          <TabsTrigger value="manad">Månadsvy</TabsTrigger>
        </TabsList>

        {/* Weekly view */}
        <TabsContent value="vecka" className="space-y-4">
          {/* Week navigator */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousWeek}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      Vecka {weekNumber}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDateShort(weekDays[0])} -{" "}
                    {formatDateShort(weekDays[6])} {format(weekDays[0], "yyyy")}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0 h-auto mt-1"
                    onClick={goToCurrentWeek}
                  >
                    Idag
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextWeek}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Target hours (FIX P6) */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Veckomålsättning</span>
                </div>
                <span className="text-sm font-semibold">
                  {weekTotal.toFixed(1)} / {targetWeeklyHours} h
                </span>
              </div>
              <Progress
                value={Math.min(
                  (weekTotal / targetWeeklyHours) * 100,
                  100
                )}
                className={`h-2 ${
                  weekTotal >= targetWeeklyHours
                    ? "[&>div]:bg-green-500"
                    : ""
                }`}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {weekTotal >= targetWeeklyHours
                  ? `Målet uppnått! (+${(weekTotal - targetWeeklyHours).toFixed(1)} h)`
                  : `${(targetWeeklyHours - weekTotal).toFixed(1)} h kvar till mål`}
              </p>
            </CardContent>
          </Card>

          {/* Weekly grid */}
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">

                {/* ===== MOBILVY: dag-för-dag per projekt ===== */}
                <div className="sm:hidden">
                  {weekProjectIds.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Inga tidsposter denna vecka.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {weekProjectIds.map((projectId) => {
                        const dayMap = weekEntryMap.get(projectId) || new Map();
                        const projectTotal = Array.from(dayMap.values()).reduce((s, h) => s + h, 0);
                        return (
                          <div
                            key={projectId}
                            className="rounded-lg border p-3"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <span className="text-sm font-medium truncate min-w-0">
                                {getProjectName(projectId)}
                              </span>
                              <span className="text-sm font-semibold shrink-0">
                                {projectTotal > 0 ? (
                                  <span className="text-primary">{fmtHours(projectTotal)}h</span>
                                ) : (
                                  <span className="text-muted-foreground/40">–</span>
                                )}
                              </span>
                            </div>
                            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                              {weekDays.map((day, i) => {
                                const dayKey = formatDateISO(day);
                                const hours = dayMap.get(dayKey) || 0;
                                const isToday = isSameDay(day, new Date());
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled={hours === 0}
                                    onClick={() => handleCellClick(projectId, dayKey)}
                                    aria-label={`${DAY_LABELS[i]} ${format(day, "d/M")}: ${fmtHours(hours)} timmar`}
                                    className={cn(
                                      "flex flex-col items-center justify-center rounded-md py-1.5 gap-0.5 transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100",
                                      hours > 0
                                        ? isToday
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-primary/10 text-primary"
                                        : isToday
                                          ? "ring-1 ring-primary/40"
                                          : "bg-muted/40"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "text-[10px] font-medium leading-none",
                                        hours > 0 ? "" : "text-muted-foreground"
                                      )}
                                    >
                                      {DAY_LABELS_SHORT[i]}
                                    </span>
                                    <span className="text-xs font-semibold leading-none tabular-nums">
                                      {hours > 0 ? (
                                        fmtHours(hours)
                                      ) : (
                                        <span className="text-muted-foreground/40">·</span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Veckosummering per dag */}
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-sm font-bold">Totalt</span>
                          <span className="text-sm font-bold text-primary">
                            {fmtHours(weekTotal)}h
                          </span>
                        </div>
                        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                          {weekDays.map((day, i) => {
                            const isToday = isSameDay(day, new Date());
                            const total = dayTotals[i];
                            return (
                              <div
                                key={i}
                                className="flex flex-col items-center justify-center gap-0.5 py-1"
                              >
                                <span
                                  className={cn(
                                    "text-[10px] font-medium leading-none",
                                    isToday ? "text-primary" : "text-muted-foreground"
                                  )}
                                >
                                  {DAY_LABELS_SHORT[i]}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold leading-none tabular-nums",
                                    total > 0 ? "text-primary" : "text-muted-foreground/40"
                                  )}
                                >
                                  {total > 0 ? fmtHours(total) : "·"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ===== DESKTOPVY: fullständig veckorutnät ===== */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: "380px", tableLayout: "fixed" }}>
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-2 font-medium pr-2">
                          Projekt
                        </th>
                        {weekDays.map((day, i) => {
                          const isToday = isSameDay(day, new Date());
                          return (
                            <th
                              key={i}
                              className={cn(
                                "text-center pb-2 font-medium w-10",
                                isToday ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              <div className="text-[11px] font-semibold">{DAY_LABELS_SHORT[i]}</div>
                              <div className={cn("text-[10px] font-normal", isToday ? "text-primary font-bold" : "text-muted-foreground/70")}>
                                {format(day, "d/M")}
                              </div>
                            </th>
                          );
                        })}
                        <th className="text-right pb-2 font-medium w-12 text-[11px]">
                          Tot
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {weekProjectIds.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="py-8 text-center text-muted-foreground text-sm"
                          >
                            Inga tidsposter denna vecka.
                          </td>
                        </tr>
                      ) : (
                        weekProjectIds.map((projectId) => {
                          const dayMap =
                            weekEntryMap.get(projectId) || new Map();
                          const projectTotal = Array.from(
                            dayMap.values()
                          ).reduce((s, h) => s + h, 0);

                          return (
                            <tr key={projectId}>
                              <td className="py-1.5 pr-2 overflow-hidden">
                                <div className="font-medium truncate text-xs">{getProjectName(projectId)}</div>
                              </td>
                              {weekDays.map((day, i) => {
                                const dayKey = formatDateISO(day);
                                const hours = dayMap.get(dayKey) || 0;
                                const isToday = isSameDay(day, new Date());
                                return (
                                  <td key={i} className="py-1.5 text-center w-10">
                                    {hours > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => handleCellClick(projectId, dayKey)}
                                        title="Redigera tidspost"
                                        className={cn(
                                          "inline-flex items-center justify-center h-6 w-9 rounded text-xs font-medium transition-opacity hover:opacity-80",
                                          isToday
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-primary/10 text-primary"
                                        )}
                                      >
                                        {hours % 1 === 0 ? hours : hours.toFixed(1)}
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground/30 text-xs">·</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-1.5 text-right font-semibold text-xs w-12">
                                {projectTotal > 0
                                  ? `${projectTotal % 1 === 0 ? projectTotal : projectTotal.toFixed(1)}h`
                                  : "–"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td className="pt-2 text-xs">Totalt</td>
                        {dayTotals.map((total, i) => (
                          <td key={i} className="pt-2 text-center w-10">
                            {total > 0 ? (
                              <span className="text-primary text-xs font-bold">
                                {total % 1 === 0 ? total : total.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">·</span>
                            )}
                          </td>
                        ))}
                        <td className="pt-2 text-right text-xs w-12">
                          {weekTotal % 1 === 0 ? weekTotal : weekTotal.toFixed(1)}h
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Monthly view (FIX F6) */}
        <TabsContent value="manad" className="space-y-4">
          {/* Month navigator */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonthDate(subMonths(monthDate, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold capitalize">
                  {format(monthDate, "MMMM yyyy", { locale: sv })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonthDate(addMonths(monthDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Heat map calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Månadskalender</CardTitle>
              <CardDescription>
                Färgkodad efter antal arbetstimmar per dag
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MonthHeatMap
                monthDate={monthDate}
                heatMap={monthHeatMap}
                targetDailyHours={dailyTargetHours}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add time entry dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ny tidspost</DialogTitle>
            <DialogDescription>
              Lägg till en ny tidsregistrering
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projekt *</Label>
              <Select
                value={newEntry.projectId}
                onValueChange={(v) =>
                  setNewEntry({ ...newEntry, projectId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj projekt..." />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map((p: Project) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} ({p.customerName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-date">Datum *</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={newEntry.date}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-hours">Timmar *</Label>
                <Input
                  id="add-hours"
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder="8"
                  value={newEntry.hours}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, hours: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
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
            <div className="space-y-2">
              <Label>Arbetsställe</Label>
              <Select
                value={
                  newEntry.location ??
                  defaultLocationFor(newEntry.projectId, newEntry.date)
                }
                onValueChange={(v) =>
                  setNewEntry({ ...newEntry, location: v as WorkLocation })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_LOCATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc">Beskrivning</Label>
              <Textarea
                id="add-desc"
                placeholder="Beskriv vad du arbetade med..."
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
              onClick={() => setShowAddDialog(false)}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleAddEntry}
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

      {/* Cell selector – when multiple entries exist for the same project/day */}
      <Dialog
        open={!!cellSelection}
        onOpenChange={(open) => !open && setCellSelection(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tidsposter</DialogTitle>
            <DialogDescription>
              {cellSelection
                ? `${getProjectName(cellSelection.projectId)}${
                    cellSelection.date
                      ? ` – ${format(parseISO(cellSelection.date), "EEEE d MMM", { locale: sv })}`
                      : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y">
            {cellSelectionEntries.map((e: TimeEntry) => (
              <button
                key={e.id}
                type="button"
                onClick={() => openEditDialog(e)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-accent/40 px-2 rounded"
              >
                <div className="min-w-0 pr-3">
                  <div className="text-sm font-medium">
                    {Number(e.hours)} h ·{" "}
                    {WORK_CATEGORY_LABELS[e.category]}
                  </div>
                  {e.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {e.description}
                    </div>
                  )}
                  {!cellSelection?.date && (
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(e.date), "EEE d MMM", { locale: sv })}
                    </div>
                  )}
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCellSelection(null)}
            >
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit time entry dialog */}
      <Dialog
        open={!!editEntry}
        onOpenChange={(open) => !open && setEditEntry(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Redigera tidspost</DialogTitle>
            <DialogDescription>
              {editEntry ? getProjectName(editEntry.projectId) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Datum *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-hours">Timmar *</Label>
                <Input
                  id="edit-hours"
                  type="number"
                  min="0"
                  step="0.25"
                  value={editForm.hours}
                  onChange={(e) =>
                    setEditForm({ ...editForm, hours: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select
                value={editForm.category}
                onValueChange={(v) =>
                  setEditForm({
                    ...editForm,
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
            <div className="space-y-2">
              <Label>Arbetsställe</Label>
              <Select
                value={editForm.location ?? "hemma"}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, location: v as WorkLocation })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_LOCATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Beskrivning</Label>
              <Textarea
                id="edit-desc"
                rows={2}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editForm.isBillable}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isBillable: checked })
                }
              />
              <Label>Debiterbar tid</Label>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteEdit}
              disabled={
                deleteTimeEntry.isPending || updateTimeEntry.isPending
              }
            >
              {deleteTimeEntry.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Ta bort
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditEntry(null)}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateTimeEntry.isPending}
              >
                {updateTimeEntry.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Spara
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Monthly heat map component ----------

function MonthHeatMap({
  monthDate,
  heatMap,
  targetDailyHours,
}: {
  monthDate: Date;
  heatMap: Map<string, number>;
  targetDailyHours: number;
}) {
  const mStart = startOfMonth(monthDate);
  const mEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: mStart, end: mEnd });

  // Get starting day offset (0 = Monday)
  const startDayOfWeek = (getDay(mStart) + 6) % 7; // Convert Sunday=0 to Monday=0

  function getHeatColor(hours: number): string {
    if (hours === 0) return "bg-muted";
    if (hours < targetDailyHours * 0.5)
      return "bg-green-200 dark:bg-green-900/40";
    if (hours < targetDailyHours)
      return "bg-green-300 dark:bg-green-800/60";
    if (hours <= targetDailyHours * 1.1)
      return "bg-green-500 dark:bg-green-700";
    return "bg-green-700 dark:bg-green-500";
  }

  return (
    <div>
      {/* Day header */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {/* Empty cells for offset */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const hours = heatMap.get(key) || 0;
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={key}
              className={cn(
                "aspect-square rounded-md flex flex-col items-center justify-center text-xs transition-colors relative",
                getHeatColor(hours),
                isToday && "ring-2 ring-primary ring-offset-1"
              )}
              title={`${format(day, "d MMMM", { locale: sv })}: ${hours.toFixed(1)} h`}
            >
              <span
                className={cn(
                  "font-medium",
                  hours > 0 ? "text-green-900 dark:text-green-100" : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              {hours > 0 && (
                <span className="text-[10px] text-green-800 dark:text-green-200 font-medium">
                  {hours.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span>Färre timmar</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-muted" />
          <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900/40" />
          <div className="w-4 h-4 rounded bg-green-300 dark:bg-green-800/60" />
          <div className="w-4 h-4 rounded bg-green-500 dark:bg-green-700" />
          <div className="w-4 h-4 rounded bg-green-700 dark:bg-green-500" />
        </div>
        <span>Fler timmar</span>
      </div>
    </div>
  );
}
