"use client";

import { useState, useMemo, useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import {
  Car,
  Plus,
  Pencil,
  Trash2,
  Camera,
  FileText,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import {
  useTrips,
  useCreateTrip,
  useUpdateTrip,
  useDeleteTrip,
  tripTotal,
  effectiveKm,
  onSiteBreakdown,
  type Trip,
  type TripReceipt,
} from "@/hooks/use-trips";
import { formatCurrency } from "@/lib/utils";
import { WORKPLACE_TYPE_LABELS, type WorkplaceType } from "@/types/project";
import { toast } from "sonner";

const NO_PROJECT = "__none__";

/** Komprimera en bild i webbläsaren till en liten JPEG-dataURL. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas saknas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

/** Läs en fil (t.ex. PDF) som base64 data-URL utan komprimering. */
function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const isPdfReceipt = (dataUrl: string) =>
  dataUrl.startsWith("data:application/pdf");

// Max filstorlek för icke-bild-kvitton (PDF), i byte. Bilder komprimeras.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  projectId: NO_PROJECT,
  purpose: "",
  fromTo: "",
  km: "",
  roundTrip: false,
  parkingSek: "",
  tollsSek: "",
  otherSek: "",
  notes: "",
};

export default function ResorPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [projectFilter, setProjectFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: trips = [], isLoading } = useTrips(year);
  const { data: projects = [] } = useProjects();
  const { data: timeEntries = [] } = useTimeEntries();
  const { data: settingsData } = useSettings();
  const settings = getSafeSettings(settingsData);

  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [receipts, setReceipts] = useState<TripReceipt[]>([]);
  const [rate, setRate] = useState(String(settings.mileageRatePerKm));
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  const filteredTrips = useMemo(() => {
    let list = trips;
    if (projectFilter === NO_PROJECT) list = list.filter((t) => !t.projectId);
    else if (projectFilter !== "all")
      list = list.filter((t) => t.projectId === projectFilter);
    if (fromDate) list = list.filter((t) => t.date >= fromDate);
    if (toDate) list = list.filter((t) => t.date <= toDate);
    return list;
  }, [trips, projectFilter, fromDate, toDate]);

  // Urval för utskrift: markerade resor (inom aktuell vy), annars hela vyn.
  const selectedInView = filteredTrips.filter((t) => selectedIds.has(t.id));
  const exportTrips = selectedInView.length > 0 ? selectedInView : filteredTrips;
  const allInViewSelected =
    filteredTrips.length > 0 && selectedInView.length === filteredTrips.length;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allInViewSelected) filteredTrips.forEach((t) => next.delete(t.id));
      else filteredTrips.forEach((t) => next.add(t.id));
      return next;
    });

  const totals = useMemo(() => {
    let km = 0;
    let mileage = 0;
    let extras = 0;
    for (const t of filteredTrips) {
      const tt = tripTotal(t);
      // Avrunda per rad och summera de avrundade beloppen, så att
      // handaddering av raderna ger exakt samma total som appen visar.
      km += tt.km;
      mileage += Math.round(tt.mileage);
      extras += Math.round(tt.extras);
    }
    return { km, mileage, extras, total: mileage + extras };
  }, [filteredTrips]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setReceipts([]);
    setRate(String(settings.mileageRatePerKm));
    setShowForm(true);
  }

  function openEdit(t: Trip) {
    setEditingId(t.id);
    setForm({
      date: t.date,
      projectId: t.projectId ?? NO_PROJECT,
      purpose: t.purpose ?? "",
      fromTo: t.fromTo ?? "",
      km: String(Number(t.km) || ""),
      roundTrip: t.roundTrip ?? false,
      parkingSek: String(Number(t.parkingSek) || ""),
      tollsSek: String(Number(t.tollsSek) || ""),
      otherSek: String(Number(t.otherSek) || ""),
      notes: t.notes ?? "",
    });
    setReceipts(t.receipts ?? []);
    setRate(String(Number(t.ratePerKm) || settings.mileageRatePerKm));
    setShowForm(true);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const added: TripReceipt[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          // Bilder komprimeras i webbläsaren.
          const dataUrl = await compressImage(file);
          added.push({ name: file.name, dataUrl });
        } else if (file.type === "application/pdf") {
          if (file.size > MAX_FILE_BYTES) {
            toast.error(`${file.name} är för stor (max 5 MB)`);
            continue;
          }
          const dataUrl = await readFileDataUrl(file);
          added.push({ name: file.name, dataUrl });
        } else {
          toast.error(`${file.name}: filtypen stöds inte (bild eller PDF)`);
        }
      }
      if (added.length) setReceipts((r) => [...r, ...added]);
    } catch {
      toast.error("Kunde inte läsa in filen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (imageRef.current) imageRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form.date) {
      toast.error("Ange datum");
      return;
    }
    const project =
      form.projectId !== NO_PROJECT
        ? projects.find((p) => p.id === form.projectId)
        : undefined;

    const payload = {
      date: form.date,
      projectId: project?.id ?? null,
      projectTitle: project?.title ?? null,
      customerName: project?.customerName ?? null,
      purpose: form.purpose || null,
      fromTo: form.fromTo || null,
      km: Number(form.km) || 0,
      roundTrip: form.roundTrip,
      ratePerKm: Number(rate) || 0,
      parkingSek: Number(form.parkingSek) || 0,
      tollsSek: Number(form.tollsSek) || 0,
      otherSek: Number(form.otherSek) || 0,
      receipts,
      notes: form.notes || null,
    };

    try {
      if (editingId) {
        await updateTrip.mutateAsync({ id: editingId, ...payload });
        toast.success("Resa uppdaterad");
      } else {
        await createTrip.mutateAsync(payload);
        toast.success("Resa sparad");
      }
      setShowForm(false);
    } catch {
      toast.error("Kunde inte spara resan");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTrip.mutateAsync(deleteId);
      toast.success("Resa borttagen");
      setDeleteId(null);
    } catch {
      toast.error("Kunde inte ta bort");
    }
  }

  async function handleExportPdf() {
    // Skriv ut markerade resor om något är valt, annars hela vyn (år/period/uppdrag).
    const exp = exportTrips;
    if (exp.length === 0) {
      toast.error("Inga resor att skriva ut för urvalet");
      return;
    }
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();

      // Totaler för just det som skrivs ut.
      let tKm = 0;
      let tMile = 0;
      let tExtra = 0;
      for (const t of exp) {
        const tt = tripTotal(t);
        tKm += tt.km;
        tMile += Math.round(tt.mileage);
        tExtra += Math.round(tt.extras);
      }

      doc.setFontSize(18);
      doc.text(settings.reportHeaderName || "Reseräkning", 20, 20);
      doc.setFontSize(13);
      doc.text("Reseräkning / körjournal", 20, 29);
      doc.setFontSize(10);
      let sub: string;
      if (selectedInView.length > 0) sub = `Valda resor: ${exp.length} st`;
      else if (fromDate || toDate)
        sub = `Period: ${fromDate || "start"} – ${toDate || "slut"}`;
      else sub = `År: ${year}`;
      if (projectFilter !== "all") {
        const p = projects.find((pr) => pr.id === projectFilter);
        sub += p ? ` · Uppdrag: ${p.title}` : " · Utan uppdrag";
      }
      doc.text(sub, 20, 37);

      // Tjänsteställe + on-site-andel (om utskriften rör ett enda uppdrag).
      let infoY = 44;
      doc.text(`Tjänsteställe: ${settings.homeBaseLabel}`, 20, infoY);
      infoY += 6;
      const projIds = Array.from(
        new Set(exp.map((t) => t.projectId).filter(Boolean))
      ) as string[];
      if (projIds.length === 1) {
        const proj = projects.find((p) => p.id === projIds[0]);
        const wpType = (proj?.workplaceType as WorkplaceType) ?? "distans";
        doc.text(
          `Uppdragets läge: ${WORKPLACE_TYPE_LABELS[wpType]}`,
          20,
          infoY
        );
        infoY += 6;
        // Perioden för andelen ska spegla det som faktiskt skrivs ut: vid
        // valda resor utan datumfilter är det resornas datumspann, inte hela
        // året. Annars redovisar en augustiutskrift junis on-site-dagar.
        let pf: string;
        let pt: string;
        if (selectedInView.length > 0 && !fromDate && !toDate) {
          const datum = exp.map((t) => t.date).sort();
          pf = datum[0];
          pt = datum[datum.length - 1];
        } else {
          pf = fromDate || `${year}-01-01`;
          pt = toDate || `${year}-12-31`;
        }
        // Beräkningen kapar vid dagens datum (framtida planerade poster
        // räknas inte) — låt den utskrivna perioden visa samma sak.
        const nu = new Date();
        const idagIso = `${nu.getFullYear()}-${String(
          nu.getMonth() + 1
        ).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
        if (pt > idagIso) pt = idagIso;
        const ob = onSiteBreakdown(trips, timeEntries, projIds[0], pf, pt);
        if (ob.totalHours > 0) {
          doc.text(
            `On-site-andel ${pf} – ${pt}: ${Math.round(ob.share * 100)}% (${
              ob.onsiteHours
            } av ${ob.totalHours} tim, ${ob.onsiteDays} on-site-dagar)`,
            20,
            infoY
          );
          infoY += 6;
        }
        if (wpType === "pa_plats") {
          doc.setTextColor(180, 90, 0);
          doc.text(
            "OBS: tjänsteställe hos kunden — resor dit är normalt arbetsresor utan skattefri ersättning.",
            20,
            infoY
          );
          doc.setTextColor(0);
          infoY += 6;
        }
      }

      const tableStartY = infoY + 1;

      const body = exp.map((t) => {
        const tt = tripTotal(t);
        const rMile = Math.round(tt.mileage);
        const rExtra = Math.round(tt.extras);
        return [
          t.date,
          [t.projectTitle, t.purpose].filter(Boolean).join(" – ") || "-",
          `${t.fromTo ?? "-"}${t.roundTrip ? " (TOR)" : ""}`,
          tt.km.toString(),
          `${Number(t.ratePerKm).toFixed(2)}`,
          rMile.toString(),
          rExtra.toString(),
          (rMile + rExtra).toString(),
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [["Datum", "Uppdrag/syfte", "Sträcka", "Km", "Kr/km", "Ers.", "Utlägg", "Summa"]],
        body,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });

      const endY = (doc as unknown as { lastAutoTable: { finalY: number } })
        .lastAutoTable.finalY;
      doc.setFontSize(10);
      doc.setFont(undefined as unknown as string, "bold");
      doc.text(
        `Total km: ${tKm}   ·   Milersättning: ${formatCurrency(
          Math.round(tMile)
        )}   ·   Utlägg: ${formatCurrency(
          Math.round(tExtra)
        )}   ·   Att ersätta: ${formatCurrency(Math.round(tMile + tExtra))}`,
        20,
        endY + 10
      );
      doc.setFont(undefined as unknown as string, "normal");

      // Bilagor: kvitton
      const receiptsList = exp.flatMap((t) =>
        (t.receipts ?? []).map((r) => ({ trip: t, receipt: r }))
      );
      for (const { trip, receipt } of receiptsList) {
        doc.addPage();
        doc.setFontSize(11);
        doc.text(
          `Kvitto – ${trip.date}${trip.purpose ? ` – ${trip.purpose}` : ""}`,
          20,
          20
        );
        if (isPdfReceipt(receipt.dataUrl)) {
          // PDF-kvitton kan inte bäddas in i jsPDF — noteras som separat bilaga.
          doc.setFontSize(10);
          doc.text(
            `PDF-bilaga: ${receipt.name}`,
            20,
            32
          );
          doc.setTextColor(120);
          doc.text(
            "(PDF-kvittot bifogas separat till ekonomisystemet.)",
            20,
            39
          );
          doc.setTextColor(0);
          continue;
        }
        const { w, h } = await getImageSize(receipt.dataUrl);
        const maxW = 170;
        const maxH = 240;
        let dw = maxW;
        let dh = (h / w) * dw;
        if (dh > maxH) {
          dh = maxH;
          dw = (w / h) * dh;
        }
        try {
          doc.addImage(receipt.dataUrl, "JPEG", 20, 28, dw, dh);
        } catch {
          doc.text("(Kunde inte bädda in bilden)", 20, 40);
        }
      }

      doc.setFontSize(8);
      doc.text(
        `Genererad ${new Date().toLocaleDateString("sv-SE")}`,
        20,
        290
      );
      const fileLabel =
        selectedInView.length > 0
          ? "urval"
          : fromDate || toDate
          ? `${fromDate || "start"}_${toDate || "slut"}`
          : String(year);
      doc.save(`reserakning-${fileLabel}.pdf`);
      toast.success("Reseräkning exporterad");
    } catch {
      toast.error("Kunde inte skapa PDF");
    } finally {
      setExporting(false);
    }
  }

  const previewRate = Number(rate) || 0;
  const previewKm = (Number(form.km) || 0) * (form.roundTrip ? 2 : 1);
  const previewExtras =
    (Number(form.parkingSek) || 0) +
    (Number(form.tollsSek) || 0) +
    (Number(form.otherSek) || 0);
  const previewTotal = previewKm * previewRate + previewExtras;

  // On-site-andel för det filtrerade uppdraget (tidsvägt, för tjänsteställe-underlag).
  const activeProjectId =
    projectFilter !== "all" && projectFilter !== NO_PROJECT
      ? projectFilter
      : null;
  const onSite = activeProjectId
    ? onSiteBreakdown(
        trips,
        timeEntries,
        activeProjectId,
        fromDate || `${year}-01-01`,
        toDate || `${year}-12-31`
      )
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resor"
        description="Kilometerersättning och utlägg per uppdrag — underlag till ekonomisystemet"
      />

      {/* Filter + åtgärder */}
      <div className="space-y-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:space-y-0 sm:gap-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">År</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-full sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Uppdrag</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla uppdrag</SelectItem>
                <SelectItem value={NO_PROJECT}>Utan uppdrag</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Från</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Till</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-1" />
            )}
            {selectedInView.length > 0
              ? `Skriv ut valda (${selectedInView.length})`
              : "Reseräkning (PDF)"}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" />
            Ny resa
          </Button>
        </div>
      </div>

      {/* Summering */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Antal resor</p>
            <p className="text-xl font-bold">{filteredTrips.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total sträcka</p>
            <p className="text-xl font-bold">{totals.km} km</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Milersättning</p>
            <p className="text-xl font-bold">{formatCurrency(Math.round(totals.mileage))}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Att ersätta totalt</p>
            <p className="text-xl font-bold">{formatCurrency(Math.round(totals.total))}</p>
          </CardContent>
        </Card>
      </div>

      {/* On-site-andel (tjänsteställe-underlag) för valt uppdrag */}
      {onSite && onSite.totalHours > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">
                On-site-andel · tjänsteställe {settings.homeBaseLabel}
              </span>
              <span
                className={`text-lg font-bold ${
                  onSite.share > 0.5 ? "text-amber-600" : "text-green-600"
                }`}
              >
                {Math.round(onSite.share * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {onSite.onsiteHours} av {onSite.totalHours} timmar on-site
              ({onSite.onsiteDays} resdagar) för perioden. On-site-dagar =
              dagar med en resa kopplad till uppdraget.
              {onSite.share > 0.5
                ? " Över 50 % — se över tjänsteställe-bedömningen."
                : " Under 50 %."}
            </p>
            {activeProjectId && (
              <p className="text-xs text-muted-foreground">
                Uppdragets läge:{" "}
                {
                  WORKPLACE_TYPE_LABELS[
                    (projects.find((p) => p.id === activeProjectId)
                      ?.workplaceType as WorkplaceType) ?? "distans"
                  ]
                }
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              Resor {fromDate || toDate ? "(vald period)" : year}
            </CardTitle>
            {filteredTrips.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={allInViewSelected}
                  onCheckedChange={toggleSelectAll}
                />
                {selectedInView.length > 0
                  ? `${selectedInView.length} valda`
                  : "Markera alla"}
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Laddar...</p>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Inga resor {projectFilter !== "all" ? "för urvalet" : `för ${year}`} ännu.
              </p>
              <Button onClick={openNew}>
                <Plus className="w-4 h-4 mr-1" />
                Lägg till första resan
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredTrips.map((t) => {
                const tt = tripTotal(t);
                return (
                  <div
                    key={t.id}
                    className={`flex items-start justify-between gap-3 rounded-md border p-3 transition-colors ${
                      selectedIds.has(t.id)
                        ? "border-primary/50 bg-primary/5"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      className="mt-1 shrink-0"
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={() => toggleSelect(t.id)}
                      aria-label="Välj resa"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {t.date}
                        </span>
                        {t.projectTitle && (
                          <Badge variant="outline" className="text-[10px]">
                            {t.projectTitle}
                          </Badge>
                        )}
                        {t.roundTrip && (
                          <Badge variant="outline" className="text-[10px]">
                            TOR
                          </Badge>
                        )}
                        {t.receipts?.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            <Camera className="w-3 h-3 mr-0.5" />
                            {t.receipts.length}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {t.purpose || "Resa"}
                      </p>
                      {t.fromTo && (
                        <p className="text-xs text-muted-foreground truncate">
                          {t.fromTo}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <p className="font-semibold text-sm">
                        {formatCurrency(Math.round(tt.total))}
                      </p>
                      <p className="text-muted-foreground">
                        {tt.km} km
                        {tt.extras > 0 && ` + ${formatCurrency(Math.round(tt.extras))}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(t)}
                        aria-label="Redigera resa"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                        aria-label="Ta bort resa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulär-dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Redigera resa" : "Ny resa"}</DialogTitle>
            <DialogDescription>
              Ersättning räknas som km × sats plus eventuella utlägg.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Uppdrag (valfritt)</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => setForm((s) => ({ ...s, projectId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>Inget uppdrag</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {projects.find((p) => p.id === form.projectId)?.workplaceType ===
              "pa_plats" && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                Detta uppdrag har tjänsteställe hos kunden — resor dit är
                normalt arbetsresor och ger ingen skattefri milersättning. Spara
                ändå om det är en resa vidare från kunden.
              </div>
            )}

            <div className="space-y-2">
              <Label>Syfte</Label>
              <Input
                value={form.purpose}
                onChange={(e) => setForm((s) => ({ ...s, purpose: e.target.value }))}
                placeholder="t.ex. Möte hos kund"
              />
            </div>

            <div className="space-y-2">
              <Label>Sträcka (från–till)</Label>
              <Input
                value={form.fromTo}
                onChange={(e) => setForm((s) => ({ ...s, fromTo: e.target.value }))}
                placeholder="t.ex. Hemorten – Kundorten t/r"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Antal km {form.roundTrip ? "(enkel väg)" : ""}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.km}
                  onChange={(e) => setForm((s) => ({ ...s, km: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Milersättning (kr/km)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={form.roundTrip}
                onCheckedChange={(v) =>
                  setForm((s) => ({ ...s, roundTrip: v === true }))
                }
              />
              <span className="text-sm">
                Tur och retur (TOR){" "}
                {form.roundTrip && previewKm > 0 && (
                  <span className="text-muted-foreground">
                    — {previewKm} km totalt
                  </span>
                )}
              </span>
            </label>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">P-avgift</Label>
                <Input
                  type="number"
                  value={form.parkingSek}
                  onChange={(e) => setForm((s) => ({ ...s, parkingSek: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Trängselskatt</Label>
                <Input
                  type="number"
                  value={form.tollsSek}
                  onChange={(e) => setForm((s) => ({ ...s, tollsSek: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Övrigt</Label>
                <Input
                  type="number"
                  value={form.otherSek}
                  onChange={(e) => setForm((s) => ({ ...s, otherSek: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Kvitton */}
            <div className="space-y-2">
              <Label>Kvitton</Label>
              {/* Kamera (mobil) */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {/* Bild från enheten (bäddas in i reseräkningen) */}
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {/* PDF (blir separat bilaga) */}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="w-4 h-4 mr-1" />
                  Ta foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-1" />
                  )}
                  Ladda upp bild
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Ladda upp PDF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bilder bäddas in i reseräknings-PDF:en. PDF-kvitton blir en
                separat bilaga utanför. Ladda gärna upp mejlkvitton som bild.
              </p>
              {receipts.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {receipts.map((r, i) => (
                    <div key={i} className="relative">
                      {isPdfReceipt(r.dataUrl) ? (
                        <div className="h-16 w-16 rounded-md border flex flex-col items-center justify-center bg-muted/40 p-1">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-0.5">
                            PDF
                          </span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.dataUrl}
                          alt={r.name}
                          className="h-16 w-16 object-cover rounded-md border"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setReceipts((rs) => rs.filter((_, idx) => idx !== i))
                        }
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"
                        aria-label="Ta bort kvitto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Anteckning</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Att ersätta</span>
              <span className="font-semibold">
                {formatCurrency(Math.round(previewTotal))}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Avbryt
            </Button>
            <Button
              onClick={handleSave}
              disabled={createTrip.isPending || updateTrip.isPending}
            >
              {(createTrip.isPending || updateTrip.isPending) && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ta bort-bekräftelse */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort resa?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kan inte ångras. Kvitton kopplade till resan tas också bort.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
