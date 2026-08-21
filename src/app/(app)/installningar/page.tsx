"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  deriveTargetBillableHoursPerYear,
} from "@/lib/settings";
import {
  getMunicipalitiesSorted,
  getMunicipalityByName,
} from "@/data/municipalities";
import { calculateFullTaxBreakdown } from "@/lib/swedish-tax";
import { TrashCard } from "@/components/installningar/trash-card";
import { formatCurrency } from "@/lib/utils";
import {
  Save,
  Loader2,
  Briefcase,
  Receipt,
  CreditCard,
  CalendarDays,
  Umbrella,
  Database,
  Download,
  Upload,
  RotateCcw,
  TrendingUp,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

const ALL_MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

export default function InstallningarPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form with fetched settings
  useEffect(() => {
    if (settings) {
      setForm({ ...DEFAULT_SETTINGS, ...settings });
      setHasChanges(false);
    }
  }, [settings]);

  const municipalities = useMemo(() => getMunicipalitiesSorted(), []);

  // Live net salary preview (L3 + L4)
  const netSalaryBreakdown = useMemo(
    () =>
      calculateFullTaxBreakdown(
        form.monthlySalaryGross,
        form.employerTaxRate,
        form.municipalTaxRate,
        form.stateTaxThreshold,
        form.stateTaxRate
      ),
    [
      form.monthlySalaryGross,
      form.employerTaxRate,
      form.municipalTaxRate,
      form.stateTaxThreshold,
      form.stateTaxRate,
    ]
  );

  // Derived billable hours breakdown (L1 / Fas 2.4)
  const derivedBillable = useMemo(() => {
    const workingWeeks = Math.max(0, 52 - form.vacationWeeks);
    const rawHours = workingWeeks * form.targetWeeklyHours;
    const absence =
      form.publicHolidayHoursPerYear +
      form.internalTimeHoursPerYear +
      form.sickLeaveHoursPerYear;
    const derived = deriveTargetBillableHoursPerYear(form);
    return { workingWeeks, rawHours, absence, derived };
  }, [form]);

  const updateField = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleMunicipalityChange = (name: string) => {
    const municipality = getMunicipalityByName(name);
    if (municipality) {
      setForm((prev) => ({
        ...prev,
        municipality: municipality.name,
        municipalTaxRate: municipality.taxRate / 100,
      }));
      setHasChanges(true);
    }
  };

  const toggleVacationMonth = (month: string) => {
    const current = form.vacationMonths || [];
    const next = current.includes(month)
      ? current.filter((m) => m !== month)
      : [...current, month];
    updateField("vacationMonths", next);
  };

  const handleSave = () => {
    updateSettings.mutate(form, {
      onSuccess: () => {
        toast.success("Inställningar sparade");
        setHasChanges(false);
      },
      onError: () => toast.error("Kunde inte spara inställningar"),
    });
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_SETTINGS });
    setHasChanges(true);
    toast.info("Inställningar återställda till standard");
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(form, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affarskoll-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Inställningar exporterade");
  };

  const handleLogoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const maxW = 500;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas
          .getContext("2d")
          ?.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG bevarar transparens — viktigt mot fakturans vita bakgrund
        updateField("companyLogoDataUrl", canvas.toDataURL("image/png"));
        URL.revokeObjectURL(url);
        toast.success("Logotyp vald — glöm inte att spara inställningarna");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Kunde inte läsa bildfilen");
      };
      img.src = url;
    };
    input.click();
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          setForm({ ...DEFAULT_SETTINGS, ...imported });
          setHasChanges(true);
          toast.success("Inställningar importerade");
        } catch {
          toast.error("Ogiltig fil - kunde inte importera");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const selectedMunicipality = getMunicipalityByName(form.municipality);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inställningar"
        description="Konfigurera dina affärsparametrar och skattesatser"
        actions={
          hasChanges ? (
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Spara ändringar
            </Button>
          ) : null
        }
      />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card 1: Affarsparametrar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Affärsparametrar
            </CardTitle>
            <CardDescription>Provision, overhead och lön</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Förmedlingspartner (namn)</Label>
              <Input
                placeholder="T.ex. konsultmäklarens bolagsnamn"
                value={form.brokerName}
                onChange={(e) => updateField("brokerName", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mellanhand som tar provision på uppdragen. Lämna tomt om du
                fakturerar kunden direkt.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Förmedlingsprovision (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={Math.round(form.brokerCommissionRate * 100 * 100) / 100}
                onChange={(e) =>
                  updateField(
                    "brokerCommissionRate",
                    Number(e.target.value) / 100
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Förmedlingsavgift (SEK/mån)</Label>
              <Input
                type="number"
                value={form.brokerMonthlyFee}
                onChange={(e) =>
                  updateField("brokerMonthlyFee", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Overhead (SEK/mån)</Label>
              <Input
                type="number"
                value={form.monthlyOverhead}
                onChange={(e) =>
                  updateField("monthlyOverhead", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Projektutgifter (SEK/mån)</Label>
              <Input
                type="number"
                value={form.projectExpenses}
                onChange={(e) =>
                  updateField("projectExpenses", Number(e.target.value))
                }
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Kassa i bolaget (SEK)</Label>
              <Input
                type="number"
                value={form.cashBuffer}
                onChange={(e) =>
                  updateField("cashBuffer", Number(e.target.value))
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Ingående kassa för Runway-beräkningen på dashboarden. Uppdatera manuellt från Dooer ca 1 ggr/månad.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Milersättning (kr/km)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.mileageRatePerKm}
                onChange={(e) =>
                  updateField("mileageRatePerKm", Number(e.target.value))
                }
                placeholder="2.5"
              />
              <p className="text-xs text-muted-foreground">
                Används för resor/kilometerersättning. 2,50 kr/km = 25 kr/mil (skattefri nivå). Bekräfta årets belopp.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tjänsteställe</Label>
              <Input
                value={form.homeBaseLabel}
                onChange={(e) =>
                  updateField("homeBaseLabel", e.target.value)
                }
                placeholder="t.ex. Åsa (hemmet)"
              />
              <p className="text-xs text-muted-foreground">
                Visas i reseräkningsunderlaget. Bolagets bedömning av tjänsteställe görs skriftligt separat.
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Bruttolön (SEK/mån)</Label>
              <Input
                type="number"
                value={form.monthlySalaryGross}
                onChange={(e) =>
                  updateField("monthlySalaryGross", Number(e.target.value))
                }
              />
            </div>

            {/* Live nettolön-preview (L3 + L4) */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bruttolön</span>
                <span>{formatCurrency(netSalaryBreakdown.grossSalary)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  &minus; Kommunalskatt ({(form.municipalTaxRate * 100).toFixed(2)}%)
                </span>
                <span>&minus;{formatCurrency(netSalaryBreakdown.municipalTax)}</span>
              </div>
              {netSalaryBreakdown.stateTax > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    &minus; Statlig skatt ({(form.stateTaxRate * 100).toFixed(0)}%)
                  </span>
                  <span>&minus;{formatCurrency(netSalaryBreakdown.stateTax)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  + Jobbskatteavdrag
                </span>
                <span>+{formatCurrency(netSalaryBreakdown.jobbskatteavdrag)}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Nettolön (ca)</span>
                <span>{formatCurrency(netSalaryBreakdown.netSalary)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Inklusive statlig skatt och jobbskatteavdrag
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Skattesatser */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Skattesatser
            </CardTitle>
            <CardDescription>Arbetsgivaravgift, moms och kommunalskatt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Arbetsgivaravgift (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={Math.round(form.employerTaxRate * 100 * 100) / 100}
                onChange={(e) =>
                  updateField("employerTaxRate", Number(e.target.value) / 100)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moms (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={Math.round(form.vatRate * 100)}
                onChange={(e) =>
                  updateField("vatRate", Number(e.target.value) / 100)
                }
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Kommun</Label>
              <Select
                value={form.municipality}
                onValueChange={handleMunicipalityChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj kommun" />
                </SelectTrigger>
                <SelectContent>
                  {municipalities.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name} ({m.taxRate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMunicipality && (
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p className="font-medium">{selectedMunicipality.name}</p>
                <p className="text-muted-foreground">
                  Län: {selectedMunicipality.county}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="flex justify-between">
                    <span>Kommunalskatt:</span>
                    <span>{selectedMunicipality.municipalTax}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Regionskatt:</span>
                    <span>{selectedMunicipality.regionTax}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Begravningsavgift:</span>
                    <span>{selectedMunicipality.burialFee}%</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Totalt:</span>
                    <span>{selectedMunicipality.taxRate}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Statlig skatt (L4) */}
            <Separator />
            <div className="space-y-2">
              <Label>Statlig skatt: brytpunkt (SEK/år)</Label>
              <Input
                type="number"
                value={form.stateTaxThreshold}
                onChange={(e) =>
                  updateField("stateTaxThreshold", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                2026 ca 614 000 kr. Lön över detta beskattas extra.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Statlig skattesats (%)</Label>
              <Input
                type="number"
                step="1"
                value={Math.round(form.stateTaxRate * 100)}
                onChange={(e) =>
                  updateField("stateTaxRate", Number(e.target.value) / 100)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Fakturering & Betalning */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Fakturering &amp; Betalning
            </CardTitle>
            <CardDescription>Betalvillkor och intäktsfördröjning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Intäktsfördröjning (månader)</Label>
              <Input
                type="number"
                min={0}
                max={6}
                value={form.defaultRevenueLagMonths}
                onChange={(e) =>
                  updateField(
                    "defaultRevenueLagMonths",
                    Number(e.target.value)
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Antal månader från utfört arbete till betalning
              </p>
            </div>
            <div className="space-y-2">
              <Label>Betalvillkor (dagar)</Label>
              <Input
                type="number"
                value={form.defaultPaymentTerms}
                onChange={(e) =>
                  updateField("defaultPaymentTerms", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Prognos-horisont (ar)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.forecastYears}
                onChange={(e) =>
                  updateField("forecastYears", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Hur många år framåt månadsprognosen gäller
              </p>
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm font-medium">Fakturauppgifter</p>
              <p className="text-xs text-muted-foreground mb-3">
                Avsändarblocket på genererade fakturor (PDF)
              </p>
              <div className="space-y-2 mb-4">
                <Label>Logotyp på fakturan</Label>
                {form.companyLogoDataUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.companyLogoDataUrl}
                      alt="Logotyp"
                      className="h-12 max-w-[160px] object-contain rounded border bg-white p-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleLogoUpload}>
                      Byt
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateField("companyLogoDataUrl", "")}
                    >
                      Ta bort
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={handleLogoUpload}>
                      Ladda upp logotyp
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Utan logotyp skrivs företagsnamnet i text på fakturan.
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organisationsnummer</Label>
                  <Input
                    value={form.companyOrgNumber}
                    onChange={(e) =>
                      updateField("companyOrgNumber", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Momsregistreringsnummer</Label>
                  <Input
                    value={form.companyVatNumber}
                    onChange={(e) =>
                      updateField("companyVatNumber", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bankgiro</Label>
                  <Input
                    value={form.companyBankgiro}
                    onChange={(e) =>
                      updateField("companyBankgiro", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gatuadress</Label>
                  <Input
                    value={form.companyStreet}
                    onChange={(e) => updateField("companyStreet", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postnummer</Label>
                  <Input
                    value={form.companyPostalCode}
                    onChange={(e) =>
                      updateField("companyPostalCode", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ort</Label>
                  <Input
                    value={form.companyCity}
                    onChange={(e) => updateField("companyCity", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon (på fakturan)</Label>
                  <Input
                    value={form.invoicePhone}
                    onChange={(e) => updateField("invoicePhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-post (på fakturan)</Label>
                  <Input
                    value={form.invoiceEmail}
                    onChange={(e) => updateField("invoiceEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Webbsida</Label>
                  <Input
                    value={form.companyWebsite}
                    onChange={(e) =>
                      updateField("companyWebsite", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Årlig planering */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Årlig planering
            </CardTitle>
            <CardDescription>Debiterbara timmar och marginaler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Veckotimmar (mål)</Label>
              <Input
                type="number"
                value={form.targetWeeklyHours}
                onChange={(e) =>
                  updateField("targetWeeklyHours", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Arbetsdagar per vecka</Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={form.workDaysPerWeek}
                onChange={(e) =>
                  updateField("workDaysPerWeek", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Används för dagligt mål och heat-map i tidsrapporteringen
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label>Härled debiterbara timmar automatiskt</Label>
                <p className="text-xs text-muted-foreground">
                  Ja = räknas från veckotimmar, semester och frånvaro.
                  Nej = använd värde nedan.
                </p>
              </div>
              <Switch
                checked={form.autoDeriveBillableHours}
                onCheckedChange={(v) =>
                  updateField("autoDeriveBillableHours", v)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Debiterbara timmar/år</Label>
              <Input
                type="number"
                value={
                  form.autoDeriveBillableHours
                    ? derivedBillable.derived
                    : form.targetBillableHoursPerYear
                }
                disabled={form.autoDeriveBillableHours}
                onChange={(e) =>
                  updateField(
                    "targetBillableHoursPerYear",
                    Number(e.target.value)
                  )
                }
                className={form.autoDeriveBillableHours ? "bg-muted" : ""}
              />
              {form.autoDeriveBillableHours && (
                <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      ({derivedBillable.workingWeeks} arbetsveckor × {form.targetWeeklyHours}h)
                    </span>
                    <span>{derivedBillable.rawHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      &minus; Frånvaro (helgdagar + intern + sjukdom)
                    </span>
                    <span>&minus;{derivedBillable.absence}h</span>
                  </div>
                  <div className="flex justify-between font-medium pt-0.5 border-t">
                    <span>= Härledd årsmålsättning</span>
                    <span>{derivedBillable.derived}h</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Säkerhetsmarginal (%)</Label>
              <Input
                type="number"
                step="1"
                value={Math.round(form.safetyMargin * 100)}
                onChange={(e) =>
                  updateField("safetyMargin", Number(e.target.value) / 100)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fasta månatliga kostnader (SEK)</Label>
              <Input
                type="number"
                value={form.fixedMonthlyCosts}
                onChange={(e) =>
                  updateField("fixedMonthlyCosts", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>3:12 gränsbelopp (SEK)</Label>
              <Input
                type="number"
                value={form.dividendLimit}
                onChange={(e) =>
                  updateField("dividendLimit", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximal utdelning med 20% skatt
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Tillgänglighet & frånvaro */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Umbrella className="w-5 h-5" />
              Tillgänglighet &amp; frånvaro
            </CardTitle>
            <CardDescription>Semester, helgdagar och intern tid</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Aktivera frånvaroavdrag</Label>
                <p className="text-xs text-muted-foreground">
                  Dra av semester, helgdagar m.m. från debiterbara timmar
                </p>
              </div>
              <Switch
                checked={form.applyAbsenceDeductions}
                onCheckedChange={(v) =>
                  updateField("applyAbsenceDeductions", v)
                }
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Semesterveckor</Label>
              <Input
                type="number"
                value={form.vacationWeeks}
                onChange={(e) =>
                  updateField("vacationWeeks", Number(e.target.value))
                }
              />
            </div>

            {/* Custom vacation months UI (Fas 2.3) */}
            <div className="space-y-2">
              <Label>Semestermånader</Label>
              <p className="text-xs text-muted-foreground">
                Klicka för att välja vilka månader du normalt tar semester
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MONTHS.map((month) => {
                  const selected = form.vacationMonths.includes(month);
                  return (
                    <Badge
                      key={month}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer capitalize select-none"
                      onClick={() => toggleVacationMonth(month)}
                    >
                      {month}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Vacation threshold (Fas 3.3 beslut B) */}
            <div className="space-y-2">
              <Label>
                Semester-tröskel: min. överlapp per månad (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={Math.round(form.vacationMonthThreshold * 100)}
                onChange={(e) =>
                  updateField(
                    "vacationMonthThreshold",
                    Math.min(1, Math.max(0, Number(e.target.value) / 100))
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                En semestermånad räknas bara om uppdraget överlappar minst
                denna andel av månaden. 0 % = varje beröring räknas.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Helgdagar (timmar/år)</Label>
              <Input
                type="number"
                value={form.publicHolidayHoursPerYear}
                onChange={(e) =>
                  updateField(
                    "publicHolidayHoursPerYear",
                    Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Intern tid (timmar/år)</Label>
              <Input
                type="number"
                value={form.internalTimeHoursPerYear}
                onChange={(e) =>
                  updateField(
                    "internalTimeHoursPerYear",
                    Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sjukdom/VAB (timmar/år)</Label>
              <Input
                type="number"
                value={form.sickLeaveHoursPerYear}
                onChange={(e) =>
                  updateField("sickLeaveHoursPerYear", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Datahantering */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5" />
              Datahantering
            </CardTitle>
            <CardDescription>Backup, import och återställning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportera inställningar (JSON)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleImport}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importera inställningar (JSON)
              </Button>
              <Separator />
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Återställ till standardvärden
              </Button>
            </div>

            <Separator />
            <div className="rounded-md border bg-primary/5 p-3 text-xs flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Årsmålsättning (förhandsgranskning)</p>
                <p className="text-muted-foreground">
                  Med nuvarande inställningar blir din debiterbara årsmålsättning{" "}
                  <span className="font-semibold text-foreground">
                    {derivedBillable.derived}h
                  </span>
                  . Det motsvarar{" "}
                  <span className="font-medium">
                    {Math.round(derivedBillable.derived / 12)}h/mån
                  </span>{" "}
                  eller{" "}
                  <span className="font-medium">
                    {(derivedBillable.derived / derivedBillable.workingWeeks).toFixed(1)}
                    h/vecka
                  </span>
                  .
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 8: Papperskorg (soft-deleted projekt) */}
        <TrashCard />

        {/* Card 7: Företagsuppgifter (Skatteverket) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Företagsuppgifter (Skatteverket)
            </CardTitle>
            <CardDescription>
              Information från Skatteverket — påverkar moms-beräkningen och deklarationspåminnelser
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>F-skatt fr.o.m.</Label>
                <Input
                  type="date"
                  value={form.fSkattFromDate}
                  onChange={(e) =>
                    updateField("fSkattFromDate", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Momsregistrerad fr.o.m.</Label>
                <Input
                  type="date"
                  value={form.vatRegisteredFromDate}
                  onChange={(e) =>
                    updateField("vatRegisteredFromDate", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Arbetsgivare fr.o.m.</Label>
                <Input
                  type="date"
                  value={form.employerRegisteredFromDate}
                  onChange={(e) =>
                    updateField("employerRegisteredFromDate", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Momsdeklaration: period</Label>
                <Select
                  value={form.vatReportingPeriod}
                  onValueChange={(v) =>
                    updateField(
                      "vatReportingPeriod",
                      v as AppSettings["vatReportingPeriod"]
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Månadsvis</SelectItem>
                    <SelectItem value="quarterly">Kvartalsvis</SelectItem>
                    <SelectItem value="yearly">Helt beskattningsår</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Redovisningsmetod</Label>
                <Select
                  value={form.vatAccountingMethod}
                  onValueChange={(v) =>
                    updateField(
                      "vatAccountingMethod",
                      v as AppSettings["vatAccountingMethod"]
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      Bokslutsmetoden (kontantmetoden)
                    </SelectItem>
                    <SelectItem value="invoice">Faktureringsmetoden</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.vatAccountingMethod === "cash"
                    ? "Moms räknas vid betalningsdatum (vanligast för småbolag)"
                    : "Moms räknas vid fakturadatum"}
                </p>
              </div>
            </div>

            {form.vatReportingPeriod === "quarterly" && (
              <div className="space-y-2 sm:max-w-xs">
                <Label>Övergångsår till kvartalsmoms (valfritt)</Label>
                <Input
                  type="number"
                  placeholder="t.ex. 2026"
                  value={form.vatQuarterlyFromYear ?? ""}
                  onChange={(e) =>
                    updateField(
                      "vatQuarterlyFromYear",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Året du gick från årsmoms till kvartalsmoms. Det året
                  deklareras Q1 och Q2 tillsammans senast 17 augusti.
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Räkenskapsår start (MM-DD)</Label>
                <Input
                  placeholder="01-01"
                  value={form.fiscalYearStart}
                  onChange={(e) =>
                    updateField("fiscalYearStart", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Räkenskapsår slut (MM-DD)</Label>
                <Input
                  placeholder="12-31"
                  value={form.fiscalYearEnd}
                  onChange={(e) => updateField("fiscalYearEnd", e.target.value)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>SNI-kod</Label>
                <Input
                  placeholder="70.200"
                  value={form.sniCode}
                  onChange={(e) => updateField("sniCode", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Verksamhet</Label>
                <Input
                  placeholder="Konsultverksamhet avseende företags organisation"
                  value={form.sniName}
                  onChange={(e) => updateField("sniName", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 8: Rapportutseende (PDF) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Rapportutseende (PDF)
            </CardTitle>
            <CardDescription>
              Styr rubriken och sidfoten i tidsrapport-PDF:en (rubriken används
              även i reseräkningen). Fakturans avsändarblock ställs in under
              Fakturering &amp; Betalning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rubrik överst</Label>
                <Input
                  placeholder="Ditt namn eller företagsnamn"
                  value={form.reportHeaderName}
                  onChange={(e) =>
                    updateField("reportHeaderName", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Visas som stor rubrik högst upp på varje rapport.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Sidfot</Label>
                <Input
                  placeholder="Mitt Konsultbolag AB"
                  value={form.reportFooter}
                  onChange={(e) =>
                    updateField("reportFooter", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Visas längst ned på varje sida, intill genereringsdatumet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
