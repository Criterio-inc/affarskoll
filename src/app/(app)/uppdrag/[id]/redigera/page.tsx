"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useProject, useUpdateProject } from "@/hooks/use-projects";
import { useCustomers } from "@/hooks/use-customers";
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
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CONTRACT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  type ContractType,
  type ProjectStatus,
  type WorkPackage,
  type ProjectPhase,
} from "@/types/project";
import { calculateHoursFromAllocation } from "@/lib/calculator-engine";

const projectSchema = z
  .object({
    customerName: z.string().min(1, "Kundnamn krävs"),
    title: z.string().min(1, "Uppdragsnamn krävs"),
    startDate: z.string().min(1, "Startdatum krävs"),
    endDate: z.string().min(1, "Slutdatum krävs"),
    budgetedHours: z.coerce
      .number()
      .positive("Budgeterade timmar måste vara större än 0"),
    contractType: z.enum(["timpris", "fastpris", "blandat", "fastpris_overtid"]),
    hourlyRate: z.coerce.number().min(0).optional().nullable(),
    fixedPrice: z.coerce.number().min(0).optional().nullable(),
    plannedHoursPerWeek: z.coerce.number().min(0).optional().nullable(),
    status: z.enum(["prospekt", "aktiv", "avslutad", "arkiverad"]),
    pipelineStatus: z.enum(["forfragan", "forhandling", "vunnen", "forlorad"]).optional().nullable(),
    brokerCommissionExempt: z.boolean().optional(),
    workplaceType: z.enum(["distans", "blandat", "pa_plats"]).optional(),
    workplaceSharePct: z.coerce.number().min(0).max(100).optional().nullable(),
    workplaceNote: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "Slutdatum måste vara efter startdatum",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      if (data.contractType === "timpris" || data.contractType === "blandat" || data.contractType === "fastpris_overtid") {
        return (
          data.hourlyRate !== undefined &&
          data.hourlyRate !== null &&
          data.hourlyRate > 0
        );
      }
      return true;
    },
    {
      message: "Timpris krävs för denna avtalstyp",
      path: ["hourlyRate"],
    }
  )
  .refine(
    (data) => {
      if (
        data.contractType === "fastpris" ||
        data.contractType === "blandat" ||
        data.contractType === "fastpris_overtid"
      ) {
        return (
          data.fixedPrice !== undefined &&
          data.fixedPrice !== null &&
          data.fixedPrice > 0
        );
      }
      return true;
    },
    {
      message: "Fast pris krävs för denna avtalstyp",
      path: ["fixedPrice"],
    }
  );

type ProjectFormData = z.infer<typeof projectSchema>;

type PipelineFormValue = "forfragan" | "forhandling" | "vunnen" | "forlorad";

function mapPipelineStatusFromDb(
  val: string | null | undefined
): PipelineFormValue {
  if (val === "förhandling") return "forhandling";
  if (val === "vunnen") return "vunnen";
  if (val === "förlorad") return "forlorad";
  return "forfragan";
}

function mapPipelineStatusToDb(
  val: string | null | undefined
): string | null {
  if (val === "forhandling") return "förhandling";
  if (val === "forfragan") return "förfrågan";
  if (val === "vunnen") return "vunnen";
  if (val === "forlorad") return "förlorad";
  return null;
}

export default function RedigeraUppdragPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: project, isLoading: projectLoading } = useProject(id);
  const updateProject = useUpdateProject();
  const { data: customers } = useCustomers();
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      customerName: "",
      title: "",
      startDate: "",
      endDate: "",
      budgetedHours: 0,
      contractType: "timpris",
      hourlyRate: null,
      fixedPrice: null,
      plannedHoursPerWeek: null,
      status: "prospekt",
      pipelineStatus: "forfragan",
      brokerCommissionExempt: false,
      workplaceType: "distans",
      workplaceSharePct: null,
      workplaceNote: "",
      notes: "",
    },
  });

  // Populate form when project loads
  useEffect(() => {
    if (project) {
      reset({
        customerName: project.customerName,
        title: project.title,
        startDate: project.startDate,
        endDate: project.endDate,
        budgetedHours: Number(project.budgetedHours ?? 0),
        contractType: project.contractType as ContractType,
        hourlyRate: project.hourlyRate
          ? Number(project.hourlyRate)
          : null,
        fixedPrice: project.fixedPrice
          ? Number(project.fixedPrice)
          : null,
        plannedHoursPerWeek: project.plannedHoursPerWeek
          ? Number(project.plannedHoursPerWeek)
          : null,
        status: project.status as ProjectStatus,
        pipelineStatus: mapPipelineStatusFromDb(project.pipelineStatus),
        brokerCommissionExempt: project.brokerCommissionExempt ?? false,
        workplaceType: (project.workplaceType as
          | "distans"
          | "blandat"
          | "pa_plats") ?? "distans",
        workplaceSharePct: project.workplaceSharePct ?? null,
        workplaceNote: project.workplaceNote || "",
        notes: project.notes || "",
      });
      setCustomerSearch(project.customerName);
      if (project.customerId) {
        setSelectedCustomerId(project.customerId);
      }
      setWorkPackages((project.workPackages as WorkPackage[]) || []);
      setPhases((project.phases as ProjectPhase[]) || []);
    }
  }, [project, reset]);

  const contractType = watch("contractType");
  const status = watch("status");
  const workplaceType = watch("workplaceType");
  const showHourlyRate =
    contractType === "timpris" ||
    contractType === "blandat" ||
    contractType === "fastpris_overtid";
  const showFixedPrice =
    contractType === "fastpris" ||
    contractType === "blandat" ||
    contractType === "fastpris_overtid";
  const showPipelineStatus = status === "prospekt";

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const addWorkPackage = () => {
    setWorkPackages([...workPackages, {
      id: crypto.randomUUID(),
      name: "",
      allocatedHours: 0,
      usedHours: 0,
    }]);
  };

  const updateWorkPackage = (index: number, updates: Partial<WorkPackage>) => {
    const updated = [...workPackages];
    updated[index] = { ...updated[index], ...updates };
    setWorkPackages(updated);
  };

  const removeWorkPackage = (index: number) => {
    setWorkPackages(workPackages.filter((_, i) => i !== index));
  };

  const addPhase = () => {
    const startDate = watch("startDate") || "";
    const endDate = watch("endDate") || "";
    const hours = startDate && endDate
      ? calculateHoursFromAllocation(startDate, endDate, 100)
      : 0;
    const newPhases = [...phases, {
      id: crypto.randomUUID(),
      name: `Fas ${phases.length + 1}`,
      startDate,
      endDate,
      allocationPercentage: 100,
      hours,
    }];
    setPhases(newPhases);
    // Update total budgeted hours from phases
    const totalHours = newPhases.reduce((sum, p) => sum + (p.hours || 0), 0);
    setValue("budgetedHours", totalHours, { shouldValidate: true });
  };

  const updatePhase = (index: number, updates: Partial<ProjectPhase>) => {
    const updated = [...phases];
    const phase = { ...updated[index], ...updates };

    // Auto-calculate hours when allocationPercentage or dates change
    if (phase.allocationPercentage != null && phase.startDate && phase.endDate) {
      phase.hours = calculateHoursFromAllocation(
        phase.startDate,
        phase.endDate,
        phase.allocationPercentage
      );
    }

    updated[index] = phase;
    setPhases(updated);
    // Update total budgeted hours from phases
    const totalHours = updated.reduce((sum, p) => sum + (p.hours || 0), 0);
    setValue("budgetedHours", totalHours, { shouldValidate: true });
  };

  const removePhase = (index: number) => {
    const updated = phases.filter((_, i) => i !== index);
    setPhases(updated);
    if (updated.length > 0) {
      const totalHours = updated.reduce((sum, p) => sum + (p.hours || 0), 0);
      setValue("budgetedHours", totalHours, { shouldValidate: true });
    }
  };

  async function onSubmit(data: ProjectFormData) {
    try {
      // Find customerId from selected customer (normaliserat namn så
      // mellanslag/skiftläge inte bryter kopplingen)
      const customerNameTrimmed = data.customerName.trim();
      const matchedCustomer = selectedCustomerId
        ? customers?.find((c) => c.id === selectedCustomerId)
        : customers?.find(
            (c) =>
              c.name.trim().toLowerCase() ===
              customerNameTrimmed.toLowerCase()
          );

      await updateProject.mutateAsync({
        id,
        customerId: matchedCustomer?.id ?? project?.customerId ?? undefined,
        customerName: customerNameTrimmed,
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate,
        budgetedHours: data.budgetedHours,
        contractType: data.contractType,
        hourlyRate: data.hourlyRate ?? undefined,
        fixedPrice: data.fixedPrice ?? undefined,
        plannedHoursPerWeek: data.plannedHoursPerWeek ?? undefined,
        brokerCommissionExempt: data.brokerCommissionExempt ?? false,
        workplaceType: data.workplaceType ?? "distans",
        workplaceSharePct: data.workplaceSharePct ?? undefined,
        workplaceNote: data.workplaceNote || undefined,
        status: data.status,
        pipelineStatus: showPipelineStatus
          ? mapPipelineStatusToDb(data.pipelineStatus)
          : undefined,
        notes: data.notes || undefined,
        workPackages,
        phases,
        usePhaseDistribution: phases.length > 0,
      } as any);
      toast.success("Uppdraget har uppdaterats!");
      router.push(`/uppdrag/${id}`);
    } catch {
      toast.error("Kunde inte uppdatera uppdraget. Försök igen.");
    }
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
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
            <p className="text-destructive">Uppdraget kunde inte hittas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/uppdrag/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Redigera uppdrag
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {project.title}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, () => {
        toast.error("Kontrollera formuläret - det finns valideringsfel.");
      })} className="space-y-6">
        {/* Customer and project info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grundinformation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer name with autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="customerName">Kund *</Label>
              <Popover
                open={customerPopoverOpen}
                onOpenChange={setCustomerPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <div>
                    <Input
                      id="customerName"
                      placeholder="Sök eller skriv kundnamn..."
                      {...register("customerName")}
                      value={customerSearch || watch("customerName")}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setValue("customerName", e.target.value, {
                          shouldValidate: true,
                        });
                        if (!customerPopoverOpen) {
                          setCustomerPopoverOpen(true);
                        }
                      }}
                      onFocus={() => setCustomerPopoverOpen(true)}
                      autoComplete="off"
                    />
                  </div>
                </PopoverTrigger>
                {filteredCustomers.length > 0 && (
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => {
                            setValue("customerName", customer.name, {
                              shouldValidate: true,
                            });
                            setCustomerSearch(customer.name);
                            setSelectedCustomerId(customer.id);
                            setCustomerPopoverOpen(false);
                          }}
                        >
                          {customer.name}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
              {errors.customerName && (
                <p className="text-sm text-destructive">
                  {errors.customerName.message}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Uppdragsnamn *</Label>
              <Input
                id="title"
                placeholder="t.ex. IT-strategi 2026"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setValue("status", v as ProjectStatus, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_STATUS_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {showPipelineStatus && (
                <div className="space-y-2">
                  <Label>Pipeline-status</Label>
                  <Select
                    value={watch("pipelineStatus") || "forfragan"}
                    onValueChange={(v) =>
                      setValue("pipelineStatus", v as any, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forfragan">Förfrågan</SelectItem>
                      <SelectItem value="forhandling">Förhandling</SelectItem>
                      <SelectItem value="vunnen">Vunnen 🎉</SelectItem>
                      <SelectItem value="forlorad">Förlorad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dates and budget */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tid och budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Startdatum *</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register("startDate")}
                />
                {errors.startDate && (
                  <p className="text-sm text-destructive">
                    {errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Slutdatum *</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
                {errors.endDate && (
                  <p className="text-sm text-destructive">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgetedHours">Budgeterade timmar *</Label>
                <Input
                  id="budgetedHours"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="t.ex. 200"
                  {...register("budgetedHours")}
                />
                {errors.budgetedHours && (
                  <p className="text-sm text-destructive">
                    {errors.budgetedHours.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedHoursPerWeek">
                  Planerade timmar/vecka
                </Label>
                <Input
                  id="plannedHoursPerWeek"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="t.ex. 40"
                  {...register("plannedHoursPerWeek")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contract and pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avtal och prissättning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Avtalstyp *</Label>
              <Select
                value={contractType}
                onValueChange={(v) =>
                  setValue("contractType", v as ContractType, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {showHourlyRate && (
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Timpris (SEK/h) *</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="t.ex. 1200"
                    {...register("hourlyRate")}
                  />
                  {errors.hourlyRate && (
                    <p className="text-sm text-destructive">
                      {errors.hourlyRate.message}
                    </p>
                  )}
                </div>
              )}
              {showFixedPrice && (
                <div className="space-y-2">
                  <Label htmlFor="fixedPrice">Fast pris (SEK) *</Label>
                  <Input
                    id="fixedPrice"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="t.ex. 250000"
                    {...register("fixedPrice")}
                  />
                  {errors.fixedPrice && (
                    <p className="text-sm text-destructive">
                      {errors.fixedPrice.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Förmedlingsprovision */}
            <div className="flex items-center justify-between rounded-md border p-3 mt-4">
              <div className="pr-3">
                <Label className="text-sm">Förmedlingspartner tar provision</Label>
                <p className="text-xs text-muted-foreground">
                  Stäng av för uppdrag utan förmedlingsprovision — då dras
                  ingen provision på faktura, intäkt eller prognos.
                </p>
              </div>
              <Switch
                checked={!watch("brokerCommissionExempt")}
                onCheckedChange={(v) =>
                  setValue("brokerCommissionExempt", !v)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Arbetsställe / tjänsteställe */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Arbetsställe / tjänsteställe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Var utförs arbetet i huvudsak?</Label>
              <Select
                value={workplaceType ?? "distans"}
                onValueChange={(v) =>
                  setValue(
                    "workplaceType",
                    v as "distans" | "blandat" | "pa_plats"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distans">
                    Distans (hemmet är tjänsteställe)
                  </SelectItem>
                  <SelectItem value="blandat">
                    Blandat (växlande, del på plats)
                  </SelectItem>
                  <SelectItem value="pa_plats">
                    På plats hos kund (tjänsteställe hos kunden)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {workplaceType === "pa_plats"
                  ? "Kundens plats är tjänsteställe — resor dit är arbetsresor och ger normalt ingen skattefri milersättning."
                  : "Hemmet är tjänsteställe — resor till kunden är tjänsteresor med milersättning."}
              </p>
            </div>
            {workplaceType === "blandat" && (
              <div className="space-y-2 sm:max-w-xs">
                <Label htmlFor="workplaceSharePct">Andel på plats (~%)</Label>
                <Input
                  id="workplaceSharePct"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="t.ex. 50"
                  {...register("workplaceSharePct")}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="workplaceNote">Bedömning / avtalshänvisning</Label>
              <Textarea
                id="workplaceNote"
                rows={3}
                placeholder="Bolagets bedömning av tjänsteställe, hänvisning till förmedlings-/kundavtal om distansomfattning, och datum..."
                {...register("workplaceNote")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anteckningar</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Eventuella anteckningar om uppdraget..."
              rows={4}
              {...register("notes")}
            />
          </CardContent>
        </Card>

        {/* Arbetspaket */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Arbetspaket</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addWorkPackage}>
              <Plus className="w-4 h-4 mr-1" />
              Lägg till
            </Button>
          </CardHeader>
          <CardContent>
            {workPackages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Inga arbetspaket. Klicka &quot;Lägg till&quot; för att skapa ett.
              </p>
            ) : (
              <div className="space-y-3">
                {workPackages.map((wp, index) => (
                  <div key={wp.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end border rounded-lg p-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Namn</Label>
                      <Input
                        value={wp.name}
                        onChange={(e) => updateWorkPackage(index, { name: e.target.value })}
                        placeholder="T.ex. Analys"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Allokerade timmar</Label>
                      <Input
                        type="number"
                        value={wp.allocatedHours}
                        onChange={(e) => updateWorkPackage(index, { allocatedHours: Number(e.target.value) })}
                        className="h-9 w-28"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => removeWorkPackage(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Faser */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Faser</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addPhase}>
              <Plus className="w-4 h-4 mr-1" />
              Lägg till
            </Button>
          </CardHeader>
          <CardContent>
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Inga faser. Klicka &quot;Lägg till&quot; för att skapa en.
              </p>
            ) : (
              <div className="space-y-3">
                {phases.map((phase, index) => (
                  <div key={phase.id} className="border rounded-lg p-3 space-y-3">
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                      <div className="space-y-1">
                        <Label className="text-xs">Namn</Label>
                        <Input
                          value={phase.name}
                          onChange={(e) => updatePhase(index, { name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive mt-5"
                        onClick={() => removePhase(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Startdatum</Label>
                        <Input
                          type="date"
                          value={phase.startDate}
                          onChange={(e) => updatePhase(index, { startDate: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Slutdatum</Label>
                        <Input
                          type="date"
                          value={phase.endDate}
                          onChange={(e) => updatePhase(index, { endDate: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Omfattning %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={10}
                          value={phase.allocationPercentage ?? ""}
                          onChange={(e) => updatePhase(index, { allocationPercentage: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="t.ex. 100"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Timmar</Label>
                        <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm">
                          {phase.hours || 0}
                        </div>
                      </div>
                    </div>
                    {phase.description !== undefined && (
                      <div className="space-y-1">
                        <Label className="text-xs">Beskrivning</Label>
                        <Input
                          value={phase.description || ""}
                          onChange={(e) => updatePhase(index, { description: e.target.value })}
                          className="h-9"
                          placeholder="Valfri beskrivning"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {phases.length > 0 && (
                  <div className="pt-2 border-t text-sm font-medium flex justify-between px-3">
                    <span>Totalt</span>
                    <span>{phases.reduce((sum, p) => sum + (p.hours || 0), 0)} timmar</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" type="button" asChild>
            <Link href={`/uppdrag/${id}`}>Avbryt</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || updateProject.isPending}
          >
            {(isSubmitting || updateProject.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Spara ändringar
          </Button>
        </div>
      </form>
    </div>
  );
}
