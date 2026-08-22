"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Send,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Pencil,
  Download,
} from "lucide-react";
import { BAS_ACCOUNTS } from "@/data/vat-scenarios";

const SALES_ACCOUNTS = ["3001", "3002", "3003", "3004", "3005", "3105", "3106"];
import {
  useInvoicePackage,
  useUpdateInvoicePackage,
  useDeleteInvoicePackage,
  useMarkInvoicePaid,
} from "@/hooks/use-invoice-packages";
import { useSettings } from "@/hooks/use-settings";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { getSafeSettings } from "@/lib/settings";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { WORK_CATEGORY_LABELS, type WorkCategory } from "@/types/project";
import { InvoiceLinesEditor } from "@/components/ekonomi/invoice-lines-editor";
import {
  type InvoiceLine,
  type TimeReportEntry,
  lineAmount,
  sumLines,
  round2,
} from "@/types/invoice";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  utkast: "Utkast",
  skickad: "Skickad",
  betald: "Betald",
  krediterad: "Krediterad",
};

const statusVariants: Record<string, "outline" | "warning" | "success" | "secondary"> = {
  utkast: "outline",
  skickad: "warning",
  betald: "success",
  krediterad: "secondary",
};

function formatDate(d: string | null): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default function FakturapaketDetaljPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: invoice, isLoading } = useInvoicePackage(id);
  const { data: settingsData } = useSettings();
  const { data: timeEntries = [] } = useTimeEntries();
  const update = useUpdateInvoicePackage();
  const remove = useDeleteInvoicePackage();
  const markPaid = useMarkInvoicePaid();
  const [pdfBusy, setPdfBusy] = useState(false);

  const [externalNumberInput, setExternalNumberInput] = useState("");
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const [paidDateInput, setPaidDateInput] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Snabb-anteckning (liten ruta)
  const [notesInput, setNotesInput] = useState("");
  useEffect(() => {
    setNotesInput(invoice?.notes ?? "");
  }, [invoice?.notes]);

  // Redigera-dialog (utkast/skickad)
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState({
    actualAmount: "",
    vatRate: "0.25",
    basAccount: "3001",
    periodStart: "",
    periodEnd: "",
    issueDate: "",
    dueDate: "",
    vatDate: "",
    adjustmentReason: "",
    reference: "",
    invoiceText: "",
    paymentTermsDays: "",
  });
  const [editLines, setEditLines] = useState<InvoiceLine[]>([]);

  function openEdit() {
    if (!invoice) return;
    setEdit({
      actualAmount: String(Number(invoice.actualAmount ?? 0)),
      vatRate: String(Number(invoice.vatRate ?? 0.25)),
      basAccount: invoice.basAccount ?? "3001",
      periodStart: invoice.periodStart ?? "",
      periodEnd: invoice.periodEnd ?? "",
      issueDate: invoice.issueDate ?? "",
      dueDate: invoice.dueDate ?? "",
      vatDate: invoice.vatDate ?? "",
      adjustmentReason: invoice.adjustmentReason ?? "",
      reference: invoice.buyerDetails?.reference ?? "",
      invoiceText: invoice.invoiceText ?? "",
      paymentTermsDays:
        invoice.paymentTermsDays != null ? String(invoice.paymentTermsDays) : "",
    });
    setEditLines(invoice.invoiceLines ?? []);
    setShowEdit(true);
  }

  // Genererad faktura = har löpnummer (beloppet styrs då av raderna)
  const isGenerated = invoice?.invoiceNumber != null;

  // Tidrapportbilagan: den frusna snapshoten från skapandet i första hand,
  // annars (äldre fakturor utan snapshot) live-läsning av kopplade tidsposter.
  const reportEntries: TimeReportEntry[] = (() => {
    if (!invoice) return [];
    if ((invoice.timeReportSnapshot ?? []).length > 0)
      return invoice.timeReportSnapshot!;
    if ((invoice.linkedTimeEntryIds ?? []).length === 0) return [];
    const ids = new Set(invoice.linkedTimeEntryIds);
    return timeEntries
      .filter((e) => ids.has(e.id))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((e) => ({
        date: e.date,
        hours: Number(e.hours),
        text:
          e.description?.trim() ||
          WORK_CATEGORY_LABELS[e.category as WorkCategory] ||
          e.category,
      }));
  })();

  async function handleDownloadPdf() {
    if (!invoice || invoice.invoiceNumber == null) return;
    setPdfBusy(true);
    try {
      await downloadInvoicePdf(
        {
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate ?? invoice.createdAt.slice(0, 10),
          dueDate: invoice.dueDate,
          paymentTermsDays: invoice.paymentTermsDays,
          buyerName: invoice.buyerName ?? invoice.customerName,
          buyerDetails: invoice.buyerDetails,
          invoiceLines: invoice.invoiceLines ?? [],
          vatRate: Number(invoice.vatRate ?? 0.25),
          invoiceText: invoice.invoiceText,
          actualAmount: Number(invoice.actualAmount ?? 0),
          timeReport:
            reportEntries.length > 0
              ? {
                  entries: reportEntries,
                  projectTitle: invoice.projectTitle,
                  customerName: invoice.customerName,
                  periodStart: invoice.periodStart,
                  periodEnd: invoice.periodEnd,
                }
              : null,
        },
        getSafeSettings(settingsData)
      );
    } catch {
      toast.error("Kunde inte skapa PDF:en");
    } finally {
      setPdfBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ekonomi/fakturor">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Tillbaka
          </Link>
        </Button>
        <Card className="border-destructive">
          <CardContent className="py-6 text-center text-destructive">
            Fakturapaketet kunde inte hittas.
          </CardContent>
        </Card>
      </div>
    );
  }

  const theoretical = Number(invoice.theoreticalAmount ?? 0);
  const actual = Number(invoice.actualAmount ?? 0);
  const adjustment = actual - theoretical;
  const hasAdjustment = Math.abs(adjustment) > 0.5;

  async function handleSetStatus(newStatus: "utkast" | "skickad") {
    if (!invoice) return;
    try {
      await update.mutateAsync({ id: invoice.id, status: newStatus });
      toast.success(
        newStatus === "skickad"
          ? "Markerad som skickad"
          : "Återställd till utkast"
      );
    } catch {
      toast.error("Kunde inte uppdatera status");
    }
  }

  async function handleSaveExternalNumber() {
    if (!invoice) return;
    if (!externalNumberInput.trim()) return;
    try {
      await update.mutateAsync({
        id: invoice.id,
        externalInvoiceNumber: externalNumberInput.trim(),
      });
      setExternalNumberInput("");
      toast.success("Fakturanummer sparat");
    } catch {
      toast.error("Kunde inte spara");
    }
  }

  async function handleSaveNotes() {
    if (!invoice) return;
    try {
      await update.mutateAsync({ id: invoice.id, notes: notesInput || null });
      toast.success("Anteckning sparad");
    } catch {
      toast.error("Kunde inte spara anteckning");
    }
  }

  async function handleSaveEdit() {
    if (!invoice) return;
    const usesLines = isGenerated && editLines.length > 0;
    const actual = usesLines
      ? sumLines(editLines)
      : Number(edit.actualAmount) || 0;
    const vatRate = Number(edit.vatRate) || 0;
    if (actual <= 0) {
      toast.error(usesLines ? "Fakturaraderna saknar belopp" : "Ange ett belopp");
      return;
    }
    if (usesLines && editLines.some((l) => !l.description.trim())) {
      toast.error("Alla fakturarader behöver en benämning");
      return;
    }
    // round2 (öre) — samma avrundning som faktura-PDF:en
    const vatAmount = round2(actual * vatRate);
    const totalInclVat = round2(actual + vatAmount);
    try {
      await update.mutateAsync({
        id: invoice.id,
        actualAmount: String(actual),
        vatRate: String(vatRate),
        vatAmount: String(vatAmount),
        totalInclVat: String(totalInclVat),
        basAccount: edit.basAccount,
        periodStart: edit.periodStart || null,
        periodEnd: edit.periodEnd || null,
        issueDate: edit.issueDate || null,
        dueDate: edit.dueDate || null,
        vatDate: edit.vatDate || null,
        adjustmentReason: edit.adjustmentReason || null,
        ...(isGenerated
          ? {
              invoiceLines: editLines,
              invoiceText: edit.invoiceText || null,
              paymentTermsDays: edit.paymentTermsDays
                ? Number(edit.paymentTermsDays)
                : null,
              buyerDetails: {
                ...(invoice.buyerDetails ?? {}),
                reference: edit.reference || null,
              },
            }
          : {}),
      });
      toast.success(isGenerated ? "Fakturan uppdaterad" : "Fakturapaket uppdaterat");
      setShowEdit(false);
    } catch {
      toast.error("Kunde inte spara ändringarna");
    }
  }

  async function handleMarkPaid() {
    if (!invoice) return;
    try {
      await markPaid.mutateAsync({ id: invoice.id, paidDate: paidDateInput });
      toast.success(
        "Markerad som betald — utgående moms-händelse skapades automatiskt"
      );
      setShowPaidDialog(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kunde inte markera";
      toast.error(msg);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    try {
      await remove.mutateAsync(invoice.id);
      toast.success("Fakturapaket borttaget");
      router.push("/ekonomi/fakturor");
    } catch {
      toast.error("Kunde inte ta bort");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/ekonomi/fakturor">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold">
                {invoice.projectTitle ?? invoice.customerName}
              </h2>
              <Badge variant={statusVariants[invoice.status]}>
                {statusLabels[invoice.status]}
              </Badge>
              {invoice.invoiceNumber != null && (
                <Badge variant="outline" className="font-mono">
                  Faktura {invoice.invoiceNumber}
                </Badge>
              )}
              {invoice.externalInvoiceNumber && (
                <Badge variant="outline" className="font-mono">
                  {invoice.externalInvoiceNumber}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{invoice.customerName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {invoice.invoiceNumber != null && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
            >
              {pdfBusy ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              Ladda ner PDF
            </Button>
          )}
          {(invoice.status === "utkast" || invoice.status === "skickad") && (
            <Button
              variant="outline"
              size="sm"
              onClick={openEdit}
              disabled={update.isPending}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Redigera
            </Button>
          )}
          {invoice.status === "utkast" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSetStatus("skickad")}
              disabled={update.isPending}
            >
              <Send className="w-4 h-4 mr-1" />
              Markera som skickad
            </Button>
          )}
          {invoice.status === "skickad" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSetStatus("utkast")}
                disabled={update.isPending}
              >
                Tillbaka till utkast
              </Button>
              <Button
                size="sm"
                onClick={() => setShowPaidDialog(true)}
                disabled={markPaid.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Markera som betald
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                Ta bort
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort fakturapaket?</AlertDialogTitle>
                <AlertDialogDescription>
                  Detta kan inte ångras. Eventuell auto-skapad moms-händelse tas också bort manuellt — kontrollera momsloggen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Ta bort
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Avvikelse-varning */}
      {hasAdjustment && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-medium">
                Avvikelse: {adjustment > 0 ? "+" : ""}
                {formatCurrency(adjustment)} mot tidsposterna
              </p>
              <p className="text-muted-foreground">
                Teoretiskt belopp (netto efter provision): {formatCurrency(theoretical)}<br />
                Faktiskt fakturerat: {formatCurrency(actual)}
              </p>
              {invoice.adjustmentReason && (
                <p className="mt-1 italic">"{invoice.adjustmentReason}"</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Fakturarader (genererad faktura) */}
          {(invoice.invoiceLines?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fakturarader</CardTitle>
                {invoice.invoiceText && (
                  <CardDescription>{invoice.invoiceText}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  {(invoice.invoiceLines ?? []).map((l) => (
                    <div
                      key={l.id}
                      className="flex justify-between items-baseline gap-3"
                    >
                      <span className="flex-1">{l.description}</span>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {l.quantity} {l.unit} × {formatCurrency(l.unitPrice)}
                      </span>
                      <span className="tabular-nums w-24 text-right">
                        {formatCurrency(lineAmount(l))}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  {invoice.buyerName && (
                    <span>
                      Köpare:{" "}
                      <span className="text-foreground">{invoice.buyerName}</span>
                    </span>
                  )}
                  {invoice.buyerDetails?.reference && (
                    <span>
                      Er referens:{" "}
                      <span className="text-foreground">
                        {invoice.buyerDetails.reference}
                      </span>
                    </span>
                  )}
                  {invoice.paymentTermsDays != null && (
                    <span>
                      Villkor:{" "}
                      <span className="text-foreground">
                        {invoice.paymentTermsDays} dagar
                      </span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Belopp */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Belopp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {theoretical > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Teoretiskt (netto efter provision)</span>
                  <span>{formatCurrency(theoretical)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Faktiskt belopp (exkl moms)</span>
                <span className="font-medium">{formatCurrency(actual)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Moms ({Math.round(Number(invoice.vatRate) * 100)} %)</span>
                <span>+{formatCurrency(Number(invoice.vatAmount))}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Totalt inkl moms</span>
                <span>{formatCurrency(Number(invoice.totalInclVat))}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                BAS-konto:{" "}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {invoice.basAccount}
                </Badge>
              </p>
            </CardContent>
          </Card>

          {/* Period & datum */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Period & datum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span>
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Utfärdat</span>
                <span>{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Förfaller</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
              {invoice.paidDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Betald</span>
                  <span className="text-green-600 font-medium">
                    {formatDate(invoice.paidDate)}
                  </span>
                </div>
              )}
              {invoice.vatDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Momsdatum (redovisas)
                  </span>
                  <span className="font-medium">
                    {formatDate(invoice.vatDate)}
                  </span>
                </div>
              )}
              {invoice.linkedTimeEntryIds.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kopplade tidsposter</span>
                  <span>{invoice.linkedTimeEntryIds.length} st</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Anteckningar (liten ruta) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anteckningar</CardTitle>
              <CardDescription>
                T.ex. kundfordran för decemberarbete som faktureras nästa år.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Skriv en notering om fakturan..."
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={
                  update.isPending || notesInput === (invoice.notes ?? "")
                }
              >
                Spara anteckning
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Höger: extern faktura / genererad faktura */}
        <div className="space-y-4">
          {isGenerated && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Faktura {invoice.invoiceNumber}
                </CardTitle>
                <CardDescription>
                  {reportEntries.length > 0
                    ? `Ladda ner och skicka till köparen — tidrapporten (${reportEntries.length} poster) följer med som bilaga`
                    : "Genererad i appen — ladda ner och skicka till köparen"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={handleDownloadPdf}
                  disabled={pdfBusy}
                >
                  {pdfBusy ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  Ladda ner PDF
                </Button>
              </CardContent>
            </Card>
          )}
          {!isGenerated && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Extern faktura
              </CardTitle>
              <CardDescription>
                Faktura skapad utanför appen? Fyll i numret här
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.externalInvoiceNumber ? (
                <>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Externt fakturanummer
                    </p>
                    <p className="font-mono font-semibold">
                      {invoice.externalInvoiceNumber}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setExternalNumberInput(invoice.externalInvoiceNumber ?? "");
                    }}
                  >
                    Ändra
                  </Button>
                  {externalNumberInput && (
                    <div className="space-y-2 pt-2">
                      <Input
                        value={externalNumberInput}
                        onChange={(e) => setExternalNumberInput(e.target.value)}
                        placeholder="Nytt nummer"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleSaveExternalNumber}
                        >
                          Spara
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExternalNumberInput("")}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">
                    Externt fakturanummer
                  </Label>
                  <Input
                    placeholder="t.ex. INV-2026-001"
                    value={externalNumberInput}
                    onChange={(e) => setExternalNumberInput(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleSaveExternalNumber}
                    disabled={!externalNumberInput.trim() || update.isPending}
                  >
                    Spara
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                💡 Fakturerar du via ett externt bokföringsprogram? Kopiera fakturanumret hit för avstämning.
              </p>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* Markera som betald-dialog */}
      <AlertDialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Markera som betald</AlertDialogTitle>
            <AlertDialogDescription>
              Vid kontantmetoden räknas momsen för året då betalningen kom in.
              När du klickar OK skapas en utgående moms-händelse automatiskt på det datum du anger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-sm">Betalningsdatum</Label>
            <Input
              type="date"
              value={paidDateInput}
              onChange={(e) => setPaidDateInput(e.target.value)}
              className="mt-1"
            />
            {invoice.vatDate && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Momsdatum är satt till {formatDate(invoice.vatDate)} — momsen
                redovisas på det datumet (arbetsåret), inte betalningsdatumet.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid}>
              Markera som betald
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Redigera-dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera fakturapaket</DialogTitle>
            <DialogDescription>
              Justera belopp, datum och redovisning. Moms och total räknas om
              automatiskt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isGenerated && editLines.length > 0 ? (
              <div className="space-y-2">
                <Label>Fakturarader</Label>
                <InvoiceLinesEditor lines={editLines} onChange={setEditLines} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Faktiskt belopp (exkl moms)</Label>
                <Input
                  type="number"
                  value={edit.actualAmount}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, actualAmount: e.target.value }))
                  }
                />
              </div>
            )}

            {isGenerated && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Er referens</Label>
                    <Input
                      value={edit.reference}
                      onChange={(e) =>
                        setEdit((s) => ({ ...s, reference: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Betalningsvillkor (dagar)</Label>
                    <Input
                      type="number"
                      value={edit.paymentTermsDays}
                      onChange={(e) =>
                        setEdit((s) => ({
                          ...s,
                          paymentTermsDays: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fakturatext</Label>
                  <Textarea
                    rows={2}
                    value={edit.invoiceText}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, invoiceText: e.target.value }))
                    }
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Moms-sats</Label>
                <Select
                  value={edit.vatRate}
                  onValueChange={(v) => setEdit((s) => ({ ...s, vatRate: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">25 %</SelectItem>
                    <SelectItem value="0.12">12 %</SelectItem>
                    <SelectItem value="0.06">6 %</SelectItem>
                    <SelectItem value="0">0 %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>BAS-konto</Label>
                <Select
                  value={edit.basAccount}
                  onValueChange={(v) =>
                    setEdit((s) => ({ ...s, basAccount: v }))
                  }
                >
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

            {/* Live-preview moms + total */}
            {(() => {
              const a =
                isGenerated && editLines.length > 0
                  ? sumLines(editLines)
                  : Number(edit.actualAmount) || 0;
              const v = round2(a * (Number(edit.vatRate) || 0));
              return (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Moms</span>
                    <span>+{formatCurrency(v)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Totalt inkl moms</span>
                    <span>{formatCurrency(a + v)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period från</Label>
                <Input
                  type="date"
                  value={edit.periodStart}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, periodStart: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Period till</Label>
                <Input
                  type="date"
                  value={edit.periodEnd}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, periodEnd: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Utfärdat</Label>
                <Input
                  type="date"
                  value={edit.issueDate}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, issueDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Förfaller</Label>
                <Input
                  type="date"
                  value={edit.dueDate}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
              <Label>Momsdatum (redovisningsår)</Label>
              <Input
                type="date"
                value={edit.vatDate}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, vatDate: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Lämna tomt för normal hantering (momsen redovisas på
                betalningsdatum vid kontantmetoden). Sätt t.ex. <strong>31 dec</strong> för
                decemberarbete som faktureras/betalas året efter — då bokförs
                kundfordran och momsen på arbetsåret. Momsdatumet styr vilket
                kvartal/år momshändelsen hamnar i.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Avvikelseorsak (valfritt)</Label>
              <Textarea
                rows={2}
                value={edit.adjustmentReason}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, adjustmentReason: e.target.value }))
                }
                placeholder="Om beloppet skiljer sig från det teoretiska..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSaveEdit} disabled={update.isPending}>
              {update.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              )}
              Spara ändringar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
