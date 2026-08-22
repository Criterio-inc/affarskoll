"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  FileText,
  History,
  Building2,
} from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { useCustomers } from "@/hooks/use-customers";
import {
  useInvoicePackages,
  useCreateInvoicePackage,
  useMarkInvoicePaid,
} from "@/hooks/use-invoice-packages";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import { BAS_ACCOUNTS } from "@/data/vat-scenarios";
import { formatCurrency } from "@/lib/utils";
import {
  isBillableCategory,
  WORK_CATEGORY_LABELS,
  type WorkCategory,
} from "@/types/project";
import { InvoiceLinesEditor } from "@/components/ekonomi/invoice-lines-editor";
import {
  type InvoiceLine,
  sumLines,
  round2,
  newLineId,
  compactDate,
  INVOICE_NUMBER_START,
  INVOICE_NUMBER_STEP,
} from "@/types/invoice";
import { toast } from "sonner";

const SALES_ACCOUNTS = ["3001", "3002", "3003", "3004", "3005", "3105", "3106"];

type Mode = "current" | "historical";

export default function NyttFakturapaketPage() {
  const router = useRouter();
  const { data: projects = [] } = useProjects();
  const { data: timeEntries = [] } = useTimeEntries();
  const { data: customers = [] } = useCustomers();
  const { data: existingPackages = [] } = useInvoicePackages();
  const { data: settingsData } = useSettings();
  const settings = getSafeSettings(settingsData);
  const brokerCommissionRate = settings.brokerCommissionRate;
  const create = useCreateInvoicePackage();
  const markPaid = useMarkInvoicePaid();

  // Läge: nytt fakturapaket från ett aktivt uppdrag, eller historiskt paket
  const [mode, setMode] = useState<Mode>("current");

  // Form state
  const [projectId, setProjectId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>(""); // för historiskt läge
  const [customerNameInput, setCustomerNameInput] = useState<string>(""); // free text om ny kund
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [actualAmount, setActualAmount] = useState<string>("");
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [vatRate, setVatRate] = useState<string>("0.25");
  const [basAccount, setBasAccount] = useState<string>("3001");
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>("");
  const [externalInvoiceNumber, setExternalInvoiceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Genererad faktura (current mode): köpare, rader, fritext, villkor
  const [buyerId, setBuyerId] = useState<string>("");
  const [buyerTouched, setBuyerTouched] = useState(false);
  const [reference, setReference] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("");
  const [dueDateTouched, setDueDateTouched] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [linesTouched, setLinesTouched] = useState(false);
  const [invoiceText, setInvoiceText] = useState<string>("");
  const [invoiceTextTouched, setInvoiceTextTouched] = useState(false);

  // Specifikt för historiskt läge
  const [isAlreadyPaid, setIsAlreadyPaid] = useState<boolean>(true);
  const [paidDate, setPaidDate] = useState<string>("");
  const [historicalProjectTitle, setHistoricalProjectTitle] = useState<string>("");

  // Selected project (current mode)
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  // Selected customer (historical mode)
  const customer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId]
  );

  // Tidsposter som redan ingår i en annan faktura för projektet — skydd mot
  // dubbelfakturering (krediterade paket räknas inte).
  const alreadyInvoicedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pkg of existingPackages) {
      if (pkg.projectId !== projectId || pkg.status === "krediterad") continue;
      for (const id of pkg.linkedTimeEntryIds ?? []) ids.add(id);
    }
    return ids;
  }, [existingPackages, projectId]);

  // Debiterbara tidsposter i perioden (current mode)
  const billableInPeriod = useMemo(() => {
    if (mode !== "current" || !projectId || !periodStart || !periodEnd)
      return [];
    return timeEntries.filter(
      (e) =>
        e.projectId === projectId &&
        e.date >= periodStart &&
        e.date <= periodEnd &&
        e.isBillable !== false &&
        isBillableCategory(e.category)
    );
  }, [timeEntries, projectId, periodStart, periodEnd, mode]);

  const matchingTimeEntries = useMemo(
    () => billableInPeriod.filter((e) => !alreadyInvoicedIds.has(e.id)),
    [billableInPeriod, alreadyInvoicedIds]
  );

  const excludedHours = useMemo(
    () =>
      billableInPeriod
        .filter((e) => alreadyInvoicedIds.has(e.id))
        .reduce((s, e) => s + Number(e.hours), 0),
    [billableInPeriod, alreadyInvoicedIds]
  );

  // Vald köpare (fakturamottagare) — förmedlingspartnern eller slutkunden
  const buyer = useMemo(
    () => customers.find((c) => c.id === buyerId),
    [customers, buyerId]
  );

  // Nästa löpnummer (förhandsvisning — servern sätter det slutgiltiga)
  const nextInvoiceNumber = useMemo(() => {
    const maxNr = existingPackages.reduce(
      (m, p) => (p.invoiceNumber != null && p.invoiceNumber > m ? p.invoiceNumber : m),
      0
    );
    return maxNr > 0 ? maxNr + INVOICE_NUMBER_STEP : INVOICE_NUMBER_START;
  }, [existingPackages]);

  const totalHours = matchingTimeEntries.reduce(
    (s, e) => s + Number(e.hours),
    0
  );
  const hourlyRate = project ? Number(project.hourlyRate ?? 0) : 0;

  // Fast del periodiserad dagbaserat mot uppdragets längd. Gäller fastpris,
  // fastpris_overtid OCH blandat — så den fasta delen aldrig föreslås i sin
  // helhet på varje delfaktura. Perioden kapas vid uppdragets längd.
  const proratedFixedGross = useMemo(() => {
    if (!project) return 0;
    const fixed = Number(project.fixedPrice ?? 0);
    if (fixed <= 0) return 0;
    const pStart = project.startDate ? new Date(project.startDate) : null;
    const pEnd = project.endDate ? new Date(project.endDate) : null;
    if (pStart && pEnd && periodStart && periodEnd) {
      const totalDays = Math.max(
        1,
        (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24) + 1
      );
      const periodDays = Math.max(
        1,
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
          (1000 * 60 * 60 * 24) +
          1
      );
      return Math.round((fixed * Math.min(periodDays, totalDays)) / totalDays);
    }
    return fixed;
  }, [project, periodStart, periodEnd]);

  // Bruttobelopp = det kunden faktureras (timmar × pris eller fastpris).
  // Förmedlingspartnern tar sin provision av detta — konsultbolaget fakturerar nettot.
  const grossAmount = useMemo(() => {
    if (mode === "historical") return 0; // ingen teoretisk grund
    if (!project) return 0;
    if (
      project.contractType === "fastpris" ||
      project.contractType === "fastpris_overtid"
    ) {
      return proratedFixedGross;
    }
    if (project.contractType === "blandat") {
      return Math.round(proratedFixedGross + totalHours * hourlyRate);
    }
    return Math.round(totalHours * hourlyRate);
  }, [project, totalHours, hourlyRate, proratedFixedGross, mode]);

  // Förmedlingsprovisionen dras av — men bara om uppdraget inte är undantaget
  // (vissa uppdrag har provisionen borttagen). Det är nettot som faktureras.
  const isBrokerExempt = project?.brokerCommissionExempt === true;
  const effectiveCommissionRate = isBrokerExempt ? 0 : brokerCommissionRate;
  const brokerCommissionAmount = Math.round(grossAmount * effectiveCommissionRate);
  const theoreticalAmount = grossAmount - brokerCommissionAmount;

  // Periodförval: innevarande månad (klampad till uppdragets start)
  useEffect(() => {
    if (project && !periodStart && !periodEnd) {
      const now = new Date();
      const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const today = now.toISOString().slice(0, 10);
      setPeriodStart(first < project.startDate ? project.startDate : first);
      setPeriodEnd(today);
    }
  }, [project, periodStart, periodEnd]);

  // Förval av köpare: förmedlingspartnern när uppdraget har provision, annars slutkunden
  useEffect(() => {
    if (mode !== "current" || !project || buyerTouched) return;
    const brokerName = settings.brokerName.trim().toLowerCase();
    const broker = brokerName
      ? customers.find((c) => c.name.toLowerCase().includes(brokerName))
      : undefined;
    const projectCustomer = customers.find(
      (c) =>
        c.id === project.customerId ||
        c.name.trim().toLowerCase() ===
          project.customerName.trim().toLowerCase()
    );
    const def = project.brokerCommissionExempt
      ? projectCustomer ?? broker
      : broker ?? projectCustomer;
    if (def && def.id !== buyerId) setBuyerId(def.id);
  }, [mode, project, customers, buyerTouched, buyerId, settings.brokerName]);

  // Köparens standarduppgifter (referens, betalningsvillkor) följer köparvalet
  useEffect(() => {
    if (mode !== "current") return;
    setReference(buyer?.invoiceReference ?? "");
    setPaymentTerms(
      String(buyer?.paymentTermsDays ?? settings.defaultPaymentTerms)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, buyerId]);

  // Förfallodatum = fakturadatum + betalningsvillkor (tills manuellt ändrat)
  useEffect(() => {
    if (!issueDate || dueDateTouched) return;
    const days =
      mode === "current"
        ? Number(paymentTerms) || settings.defaultPaymentTerms
        : settings.defaultPaymentTerms;
    const d = new Date(issueDate);
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }, [issueDate, paymentTerms, mode, dueDateTouched, settings.defaultPaymentTerms]);

  // Föreslå fakturarader ur uppdrag + period (tills raderna redigerats)
  useEffect(() => {
    if (mode !== "current" || !project || linesTouched) return;
    if (!periodStart || !periodEnd) return;
    const netRate = round2(hourlyRate * (1 - effectiveCommissionRate));
    const next: InvoiceLine[] = [];
    if (project.contractType === "blandat") {
      const fixedNet = round2(
        proratedFixedGross * (1 - effectiveCommissionRate)
      );
      if (fixedNet > 0)
        next.push({
          id: newLineId(),
          description: "Konsultuppdrag (fast del, periodiserad)",
          quantity: 1,
          unit: "st",
          unitPrice: fixedNet,
        });
      next.push({
        id: newLineId(),
        description: "Konsultuppdrag",
        quantity: round2(totalHours),
        unit: "timmar",
        unitPrice: netRate,
      });
    } else if (
      project.contractType === "fastpris" ||
      project.contractType === "fastpris_overtid"
    ) {
      next.push({
        id: newLineId(),
        description: "Konsultuppdrag (fastpris)",
        quantity: 1,
        unit: "st",
        unitPrice: theoreticalAmount,
      });
    } else {
      next.push({
        id: newLineId(),
        description: "Konsultuppdrag",
        quantity: round2(totalHours),
        unit: "timmar",
        unitPrice: netRate,
      });
    }
    setLines(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, project, linesTouched, periodStart, periodEnd, totalHours, hourlyRate, effectiveCommissionRate, theoreticalAmount, proratedFixedGross]);

  // Fritextraden: börja från förra fakturans text för uppdraget (byt period),
  // annars en enkel mall med slutkund + period.
  useEffect(() => {
    if (mode !== "current" || !project || invoiceTextTouched) return;
    if (!periodStart || !periodEnd) return;
    const periodText = `${compactDate(periodStart)} - ${compactDate(periodEnd)}`;
    const prev = [...existingPackages]
      .filter((p) => p.projectId === project.id && p.invoiceText)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    if (prev?.invoiceText && /\d{6}\s*-\s*\d{6}/.test(prev.invoiceText)) {
      setInvoiceText(prev.invoiceText.replace(/\d{6}\s*-\s*\d{6}/, periodText));
    } else {
      setInvoiceText(
        `${project.customerName}, under perioden ${periodText}`
      );
    }
  }, [mode, project, invoiceTextTouched, periodStart, periodEnd, existingPackages]);

  // I historiskt läge: default paidDate = issueDate + 30
  useEffect(() => {
    if (mode === "historical" && isAlreadyPaid && issueDate && !paidDate) {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      setPaidDate(d.toISOString().slice(0, 10));
    }
  }, [mode, isAlreadyPaid, issueDate, paidDate]);

  // I current-läget kommer beloppet alltid ur fakturaraderna
  const actualNum =
    mode === "current" ? sumLines(lines) : Number(actualAmount) || 0;
  const vatRateNum = Number(vatRate) || 0;
  // round2 (öre) — samma avrundning som faktura-PDF:en, så sparat belopp
  // alltid matchar det kunden ser
  const vatAmount = round2(actualNum * vatRateNum);
  const totalInclVat = round2(actualNum + vatAmount);
  const adjustment = mode === "current" ? actualNum - theoreticalAmount : 0;
  const hasAdjustment = mode === "current" && Math.abs(adjustment) > 1;

  // Resolved customer name
  const resolvedCustomerName =
    mode === "current"
      ? project?.customerName ?? ""
      : customer?.name ?? customerNameInput.trim();

  // Resolved project title (visningsfält i fakturapaketet)
  const resolvedProjectTitle =
    mode === "current"
      ? project?.title ?? null
      : historicalProjectTitle.trim() || null;

  async function handleSave() {
    if (mode === "current") {
      if (!project) {
        toast.error("Välj ett uppdrag");
        return;
      }
      if (!buyer) {
        toast.error("Välj en köpare (fakturamottagare)");
        return;
      }
      if (lines.length === 0 || lines.some((l) => !l.description.trim())) {
        toast.error("Alla fakturarader behöver en benämning");
        return;
      }
      if (actualNum <= 0) {
        toast.error("Fakturan saknar belopp — kontrollera raderna");
        return;
      }
      if (hasAdjustment && !adjustmentReason.trim()) {
        toast.error("Beloppet avviker från tidsposterna — ange en avvikelseorsak");
        return;
      }
    } else {
      if (!resolvedCustomerName) {
        toast.error("Välj eller ange en kund");
        return;
      }
      if (actualNum <= 0) {
        toast.error("Ange ett belopp");
        return;
      }
      if (isAlreadyPaid && !paidDate) {
        toast.error("Ange betalningsdatum");
        return;
      }
    }

    try {
      const created = await create.mutateAsync({
        customerName: resolvedCustomerName,
        customerId:
          mode === "current"
            ? project?.customerId ?? null
            : customer?.id ?? null,
        projectId: mode === "current" ? project?.id ?? null : null,
        projectTitle: resolvedProjectTitle,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        theoreticalAmount: theoreticalAmount,
        actualAmount: actualNum,
        adjustmentReason: hasAdjustment ? adjustmentReason : null,
        vatRate: vatRateNum,
        vatAmount,
        totalInclVat,
        basAccount,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        externalInvoiceNumber: externalInvoiceNumber || null,
        linkedTimeEntryIds:
          mode === "current" ? matchingTimeEntries.map((e) => e.id) : [],
        notes: notes || null,
        status: mode === "historical" && isAlreadyPaid ? "skickad" : "utkast",
        // Genererad faktura (löpnumret sätts av servern)
        ...(mode === "current"
          ? {
              assignInvoiceNumber: true,
              invoiceLines: lines,
              buyerName: buyer?.name ?? null,
              buyerDetails: {
                orgNumber: buyer?.orgNumber ?? null,
                street: buyer?.invoiceStreet ?? null,
                postalCode: buyer?.invoicePostalCode ?? null,
                city: buyer?.invoiceCity ?? null,
                country: buyer?.invoiceCountry ?? "Sverige",
                reference: reference.trim() || null,
                deliveryAddress: buyer?.deliveryAddress ?? null,
              },
              invoiceText: invoiceText.trim() || null,
              paymentTermsDays:
                Number(paymentTerms) || settings.defaultPaymentTerms,
              // Frys tidrapportbilagan vid skapandet — PDF:en ska återskapas
              // identiskt även om tidsposterna ändras i efterhand
              timeReportSnapshot: [...matchingTimeEntries]
                .sort((a, b) => (a.date < b.date ? -1 : 1))
                .map((e) => ({
                  date: e.date,
                  hours: Number(e.hours),
                  text:
                    e.description?.trim() ||
                    WORK_CATEGORY_LABELS[e.category as WorkCategory] ||
                    e.category,
                })),
            }
          : {}),
      });

      // Vid historiskt + redan betalt: trigga mark-paid så moms-händelse skapas
      if (mode === "historical" && isAlreadyPaid) {
        await markPaid.mutateAsync({ id: created.id, paidDate });
        toast.success(
          "Historiskt fakturapaket sparat och markerat som betalt — utgående moms-händelse skapad"
        );
      } else if (mode === "current" && created.invoiceNumber != null) {
        toast.success(`Faktura ${created.invoiceNumber} skapad som utkast`);
      } else {
        toast.success("Fakturapaket skapat");
      }
      router.push(`/ekonomi/fakturor/${created.id}`);
    } catch {
      toast.error("Kunde inte skapa fakturapaket");
    }
  }

  const activeProjects = projects.filter((p) => p.status === "aktiv");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/ekonomi/fakturor">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Ny faktura</h2>
          <p className="text-sm text-muted-foreground">
            Byggs från uppdragets tidsposter, får nästa löpnummer och kan
            laddas ner som PDF
          </p>
        </div>
      </div>

      {/* Lägesväljare */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-sm">
                {mode === "historical"
                  ? "Historiskt fakturapaket"
                  : "Vanligt fakturapaket"}
              </p>
              <p className="text-xs text-muted-foreground">
                {mode === "historical"
                  ? "För gamla/förlorade uppdrag som behövs för moms — koppling till uppdrag är valfri."
                  : "Skapas från ett aktivt uppdrag — tidsposter, rader och löpnummer sätts automatiskt."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mode-toggle" className="text-sm">
              Historiskt
            </Label>
            <Switch
              id="mode-toggle"
              checked={mode === "historical"}
              onCheckedChange={(v) => {
                setMode(v ? "historical" : "current");
                setProjectId("");
                setCustomerId("");
                setActualAmount("");
                setLines([]);
                setLinesTouched(false);
                setInvoiceText("");
                setInvoiceTextTouched(false);
                setBuyerTouched(false);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* CURRENT MODE: Uppdrag och period */}
          {mode === "current" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Uppdrag och period</CardTitle>
                <CardDescription>
                  Välj uppdrag — tidsposter i perioden hämtas automatiskt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Uppdrag</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj uppdrag" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title} ({p.customerName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period från</Label>
                    <Input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period till</Label>
                    <Input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>

                {project && periodStart && periodEnd && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tidsposter i perioden
                      </span>
                      <span>
                        {matchingTimeEntries.length} st · {totalHours.toFixed(1)} h
                      </span>
                    </div>
                    {excludedHours > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span>Redan fakturerade (ingår ej)</span>
                        <span>{excludedHours.toFixed(1)} h</span>
                      </div>
                    )}
                    {hourlyRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timpris</span>
                        <span>{formatCurrency(hourlyRate)}/h</span>
                      </div>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bruttobelopp</span>
                      <span>{formatCurrency(grossAmount)}</span>
                    </div>
                    {isBrokerExempt ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Förmedlingsprovision</span>
                        <span>Tas ej ut på detta uppdrag</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          − Förmedlingsprovision ({Math.round(brokerCommissionRate * 100)} %)
                        </span>
                        <span>−{formatCurrency(brokerCommissionAmount)}</span>
                      </div>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-medium">
                      <span>Teoretiskt belopp (netto)</span>
                      <span>{formatCurrency(theoreticalAmount)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CURRENT MODE: Köpare (fakturamottagare) */}
          {mode === "current" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Köpare
                </CardTitle>
                <CardDescription>
                  Den fakturan ställs till — vid förmedlade uppdrag är det partnern,
                  slutkunden nämns i fakturatexten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Fakturamottagare</Label>
                  <Select
                    value={buyerId}
                    onValueChange={(v) => {
                      setBuyerId(v);
                      setBuyerTouched(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj köpare" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {buyer && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{buyer.name}</p>
                    {buyer.invoiceStreet ? (
                      <>
                        <p>{buyer.invoiceStreet}</p>
                        <p>
                          {buyer.invoicePostalCode} {buyer.invoiceCity}
                        </p>
                        <p>{buyer.invoiceCountry ?? "Sverige"}</p>
                      </>
                    ) : (
                      <p className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Fakturaadress saknas —{" "}
                          <Link href="/kunder" className="underline">
                            komplettera kundkortet
                          </Link>
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Er referens</Label>
                    <Input
                      placeholder="t.ex. Anna-Karin Jönsson"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Betalningsvillkor (dagar)</Label>
                    <Input
                      type="number"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CURRENT MODE: Fakturarader */}
          {mode === "current" && project && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fakturarader</CardTitle>
                <CardDescription>
                  Föreslås från tidsposterna (à-pris = timpris efter
                  Förmedlingsprovision) — redigera fritt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InvoiceLinesEditor
                  lines={lines}
                  onChange={(next) => {
                    setLines(next);
                    setLinesTouched(true);
                  }}
                />
                <div className="space-y-2">
                  <Label>Fakturatext (visas på fakturan)</Label>
                  <Textarea
                    rows={2}
                    value={invoiceText}
                    onChange={(e) => {
                      setInvoiceText(e.target.value);
                      setInvoiceTextTouched(true);
                    }}
                    placeholder="t.ex. Kundbolaget AB enligt avtal 123, under perioden 260601 - 260630"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* HISTORICAL MODE: Kund och period */}
          {mode === "historical" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kund och period</CardTitle>
                <CardDescription>
                  För historiska uppdrag som inte finns kvar i appen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Kund</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj befintlig kund" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Eller skriv namnet manuellt om kunden inte finns:
                  </p>
                  <Input
                    placeholder="t.ex. Kundbolaget AB"
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Uppdragsnamn (för referens)</Label>
                  <Input
                    placeholder="t.ex. Förändringsledning hösten 2025"
                    value={historicalProjectTitle}
                    onChange={(e) => setHistoricalProjectTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period från (valfritt)</Label>
                    <Input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period till (valfritt)</Label>
                    <Input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Belopp */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {mode === "current" ? "Moms & konto" : "Belopp"}
              </CardTitle>
              <CardDescription>
                {mode === "current"
                  ? "Beloppet räknas ur fakturaraderna. Skriv anledning om det avviker från tidsposterna."
                  : "Ange det belopp du faktiskt fakturerade"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "historical" && (
                <div className="space-y-2">
                  <Label>Faktiskt belopp (exkl moms)</Label>
                  <Input
                    type="number"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}

              {hasAdjustment && (
                <div className="rounded-md border bg-amber-500/10 border-amber-500/30 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">
                      Avvikelse: {adjustment > 0 ? "+" : ""}
                      {formatCurrency(adjustment)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Anledning till avvikelse</Label>
                    <Textarea
                      placeholder="T.ex. överenskommelse om rundat tak"
                      rows={2}
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Moms-sats</Label>
                  <Select value={vatRate} onValueChange={setVatRate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">25 %</SelectItem>
                      <SelectItem value="0.12">12 %</SelectItem>
                      <SelectItem value="0.06">6 %</SelectItem>
                      <SelectItem value="0">0 % (omvänd / momsfri)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>BAS-konto</Label>
                  <Select value={basAccount} onValueChange={setBasAccount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_ACCOUNTS.map((num) => (
                        <SelectItem key={num} value={num}>
                          {num} — {BAS_ACCOUNTS[num as keyof typeof BAS_ACCOUNTS].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datum och extern referens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {mode === "current" ? "Datum" : "Datum & referens"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Utfärdandedatum</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Förfallodatum</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setDueDateTouched(true);
                    }}
                  />
                </div>
              </div>

              {mode === "historical" && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Redan betald?</Label>
                      <p className="text-xs text-muted-foreground">
                        Vanligtvis ja för historiska uppdrag — då skapas moms-händelsen automatiskt
                      </p>
                    </div>
                    <Switch
                      checked={isAlreadyPaid}
                      onCheckedChange={setIsAlreadyPaid}
                    />
                  </div>
                  {isAlreadyPaid && (
                    <div className="space-y-2 rounded-md border bg-green-500/5 border-green-500/30 p-3">
                      <Label className="text-sm">
                        Betalningsdatum (avgör momsår med kontantmetoden)
                      </Label>
                      <Input
                        type="date"
                        value={paidDate}
                        onChange={(e) => setPaidDate(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Vid kontantmetoden räknas momsen för året då betalningen kom in.
                      </p>
                    </div>
                  )}
                </>
              )}

              {mode === "historical" && (
                <div className="space-y-2">
                  <Label>Externt fakturanummer (valfritt)</Label>
                  <Input
                    placeholder="t.ex. INV-2025-001"
                    value={externalInvoiceNumber}
                    onChange={(e) => setExternalInvoiceNumber(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Anteckningar</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Egna anteckningar om paketet..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Höger kolumn: sammanfattning */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Sammanfattning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(mode === "current" && project) ||
              (mode === "historical" && resolvedCustomerName) ? (
                <>
                  <div className="space-y-1">
                    {mode === "current" && (
                      <Badge variant="outline" className="font-mono mb-1">
                        Faktura {nextInvoiceNumber}
                      </Badge>
                    )}
                    {resolvedProjectTitle && (
                      <p className="font-medium">{resolvedProjectTitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {resolvedCustomerName}
                    </p>
                    {mode === "current" && buyer && (
                      <p className="text-xs text-muted-foreground">
                        Köpare: {buyer.name}
                      </p>
                    )}
                    {mode === "historical" && (
                      <Badge variant="outline" className="text-[10px] mt-1">
                        Historiskt
                      </Badge>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Belopp exkl moms
                      </span>
                      <span className="font-medium">
                        {formatCurrency(actualNum)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        + Moms ({Math.round(vatRateNum * 100)} %)
                      </span>
                      <span>{formatCurrency(vatAmount)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Totalt</span>
                      <span>{formatCurrency(totalInclVat)}</span>
                    </div>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Konto{" "}
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px]"
                    >
                      {basAccount}
                    </Badge>
                  </p>
                  {mode === "historical" && isAlreadyPaid && paidDate && (
                    <p className="text-xs text-green-700 dark:text-green-400">
                      ✓ Markeras som betald · momsår {paidDate.slice(0, 4)}
                    </p>
                  )}

                  <Button
                    className="w-full mt-4"
                    onClick={handleSave}
                    disabled={create.isPending || markPaid.isPending}
                  >
                    {(create.isPending || markPaid.isPending) && (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    )}
                    {mode === "historical"
                      ? isAlreadyPaid
                        ? "Spara + markera betald"
                        : "Spara som utkast"
                      : `Skapa faktura ${nextInvoiceNumber}`}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {mode === "current"
                    ? "Välj ett uppdrag för att se sammanfattning"
                    : "Välj eller ange en kund + belopp"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
