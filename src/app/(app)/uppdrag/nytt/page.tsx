"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, BookOpen, Trash2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useCustomers } from "@/hooks/use-customers";
import {
  useProjectTemplates,
  useDeleteProjectTemplate,
} from "@/hooks/use-project-templates";
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
  PIPELINE_STATUS_LABELS,
  type ContractType,
  type ProjectStatus,
  type PipelineStatus,
} from "@/types/project";

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
    pipelineStatus: z
      .enum(["forfragan", "forhandling", "vunnen", "forlorad"])
      .optional()
      .nullable(),
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
      if (
        data.contractType === "timpris" ||
        data.contractType === "blandat" ||
        data.contractType === "fastpris_overtid"
      ) {
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

export default function NyttUppdragPage() {
  const router = useRouter();
  const createProject = useCreateProject();
  const { data: customers } = useCustomers();
  const { data: existingProjects = [] } = useProjects();
  const { data: templates = [] } = useProjectTemplates();
  const deleteTemplate = useDeleteProjectTemplate();
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [smartDefaultApplied, setSmartDefaultApplied] = useState(false);

  // C13: Hämta senaste aktiva uppdrag som "smart default"-källa
  const lastProject = useMemo(() => {
    if (!existingProjects.length) return null;
    // Sortera nyaste först (createdAt redan i den ordningen från API)
    return existingProjects[0] ?? null;
  }, [existingProjects]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      customerName: "",
      title: "",
      startDate: "",
      endDate: "",
      budgetedHours: undefined,
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

  // Filter customers for dropdown
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  // C13: ärv värden från senaste uppdraget (kontraktstyp, timpris, h/v)
  function applySmartDefaults() {
    if (!lastProject) return;
    setValue("contractType", lastProject.contractType);
    if (lastProject.hourlyRate != null) {
      setValue("hourlyRate", Number(lastProject.hourlyRate));
    }
    if (lastProject.fixedPrice != null) {
      setValue("fixedPrice", Number(lastProject.fixedPrice));
    }
    if (lastProject.plannedHoursPerWeek != null) {
      setValue("plannedHoursPerWeek", Number(lastProject.plannedHoursPerWeek));
    }
    setSmartDefaultApplied(true);
    toast.success(
      `Förifyllt från "${lastProject.title}" — justera vad som behövs`
    );
  }

  // Auto-applicera smart default när formuläret renderas (kan stängas av av användaren)
  useEffect(() => {
    if (
      !smartDefaultApplied &&
      lastProject &&
      templates.length === 0 // applicera bara om användaren inte har egna mallar (mallarna är bättre prio)
    ) {
      // Sätt utan toast, tyst
      setValue("contractType", lastProject.contractType);
      if (lastProject.hourlyRate != null) {
        setValue("hourlyRate", Number(lastProject.hourlyRate));
      }
      setSmartDefaultApplied(true);
    }
  }, [lastProject, smartDefaultApplied, templates.length, setValue]);

  // Fas 5.4: apply a template to pre-fill the form
  function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const data = tpl.templateData as Record<string, any>;
    if (data.title) setValue("title", `${data.title} (kopia)`);
    if (data.contractType) setValue("contractType", data.contractType);
    if (data.budgetedHours != null) setValue("budgetedHours", Number(data.budgetedHours));
    if (data.hourlyRate != null) setValue("hourlyRate", Number(data.hourlyRate));
    if (data.fixedPrice != null) setValue("fixedPrice", Number(data.fixedPrice));
    if (data.plannedHoursPerWeek != null)
      setValue("plannedHoursPerWeek", Number(data.plannedHoursPerWeek));
    if (data.notes) setValue("notes", String(data.notes));
    toast.success(`Mall "${tpl.name}" applicerad`);
  }

  async function handleDeleteTemplate(id: string) {
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Mall borttagen");
    } catch {
      toast.error("Kunde inte ta bort mall");
    }
  }

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

      await createProject.mutateAsync({
        customerId: matchedCustomer?.id ?? undefined,
        customerName: customerNameTrimmed,
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate,
        budgetedHours: data.budgetedHours,
        contractType: data.contractType as any,
        hourlyRate: data.hourlyRate ?? undefined,
        fixedPrice: data.fixedPrice ?? undefined,
        plannedHoursPerWeek: data.plannedHoursPerWeek ?? undefined,
        brokerCommissionExempt: data.brokerCommissionExempt ?? false,
        workplaceType: data.workplaceType ?? "distans",
        workplaceSharePct: data.workplaceSharePct ?? undefined,
        workplaceNote: data.workplaceNote || undefined,
        status: data.status as any,
        pipelineStatus: showPipelineStatus
          ? data.pipelineStatus === "forhandling"
            ? "förhandling"
            : data.pipelineStatus === "vunnen"
            ? "vunnen"
            : data.pipelineStatus === "forlorad"
            ? "förlorad"
            : "förfrågan"
          : ("förfrågan" as const),
        notes: data.notes || undefined,
        workPackages: [],
        phases: [],
      } as any);
      toast.success("Uppdrag skapat!");
      router.push("/uppdrag");
    } catch {
      toast.error("Kunde inte skapa uppdraget. Försök igen.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/uppdrag">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nytt uppdrag</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Skapa ett nytt konsultuppdrag
          </p>
        </div>
      </div>

      {/* Template selector (Fas 5.4) */}
      {/* C13: Smart default-knapp om senaste uppdrag finns och ingen mall är tillgänglig */}
      {lastProject && templates.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <div className="text-sm">
                <p className="font-medium">
                  Ärv från senaste uppdraget?
                </p>
                <p className="text-xs text-muted-foreground">
                  Kontraktstyp, timpris och h/v från "{lastProject.title}"
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applySmartDefaults}
            >
              Förifyll
            </Button>
          </CardContent>
        </Card>
      )}

      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Skapa från mall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center gap-1 rounded-md border bg-muted/30 pr-1"
                >
                  <button
                    type="button"
                    onClick={() => applyTemplate(tpl.id)}
                    className="px-3 py-1.5 text-sm font-medium hover:text-primary"
                  >
                    {tpl.name}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

              {/* Pipeline status (only for prospekt) */}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 mt-4">
              <div className="min-w-0">
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

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" type="button" asChild>
            <Link href="/uppdrag">Avbryt</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting || createProject.isPending}>
            {(isSubmitting || createProject.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Skapa uppdrag
          </Button>
        </div>
      </form>
    </div>
  );
}
