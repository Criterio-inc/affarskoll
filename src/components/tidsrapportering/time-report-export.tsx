"use client";

// Tidsrapportexport (CSV + PDF) — flyttad från gamla Rapporter-sidan.
// Självständig dialog med kund-/projekt-/periodfilter; knappen renderas
// som trigger och läggs i Tidsrapporteringens header.

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, FileDown } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useCustomers } from "@/hooks/use-customers";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import { isBillableCategory } from "@/types/project";
import { projectBelongsToCustomer } from "@/lib/utils";
import { toast } from "sonner";

// Gemensam sidfot: bolagstext till vänster, genereringsdatum till höger
// på A4-botten (sidbredd 210 mm).
function drawReportFooter(doc: any, footerText: string) {
  doc.setFontSize(8);
  doc.setFont(undefined as any, "normal");
  if (footerText) doc.text(footerText, 20, 287);
  doc.text(
    `Genererad: ${new Date().toLocaleDateString("sv-SE")}`,
    190,
    287,
    { align: "right" }
  );
}

function firstOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TimeReportExportDialog() {
  const { data: projects = [] } = useProjects();
  const { data: customers = [] } = useCustomers();
  const { data: timeEntries = [] } = useTimeEntries();
  const { data: settings } = useSettings();
  const safeSettings = getSafeSettings(settings);

  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("all");
  const [projectId, setProjectId] = useState("all");

  // Projekt tillgängliga i filtret (begränsas av vald kund)
  const filterProjects = useMemo(() => {
    if (customerId === "all") return projects;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return projects;
    return projects.filter((p) => projectBelongsToCustomer(p, customer));
  }, [projects, customers, customerId]);

  const handleCustomerChange = useCallback((value: string) => {
    setCustomerId(value);
    setProjectId("all");
  }, []);

  const getFilteredEntries = useCallback(() => {
    return timeEntries.filter((e) => {
      if (e.date < startDate || e.date > endDate) return false;
      if (projectId !== "all") return e.projectId === projectId;
      if (customerId !== "all") {
        const customer = customers.find((c) => c.id === customerId);
        if (!customer) return false;
        const customerProjectIds = projects
          .filter((p) => projectBelongsToCustomer(p, customer))
          .map((p) => p.id);
        return customerProjectIds.includes(e.projectId);
      }
      return true;
    });
  }, [timeEntries, startDate, endDate, customerId, projectId, customers, projects]);

  const fileSuffix = useCallback(() => {
    const parts: string[] = [];
    if (customerId !== "all") {
      const c = customers.find((cu) => cu.id === customerId);
      if (c) parts.push(c.name.replace(/[^a-zA-Z0-9åäöÅÄÖ_-]/g, "_"));
    }
    if (projectId !== "all") {
      const p = projects.find((pr) => pr.id === projectId);
      if (p) parts.push(p.title.replace(/[^a-zA-Z0-9åäöÅÄÖ_-]/g, "_"));
    }
    return parts.length > 0 ? `-${parts.join("-")}` : "";
  }, [customerId, projectId, customers, projects]);

  const handleCsv = useCallback(() => {
    if (!startDate || !endDate) {
      toast.error("Välj period");
      return;
    }
    const periodEntries = getFilteredEntries();
    if (periodEntries.length === 0) {
      toast.error("Inga tidregistreringar för det valda urvalet");
      return;
    }

    // Kund-kolumn för att underlätta filtrering i Excel
    const rows: string[][] = [
      ["Datum", "Kund", "Projekt", "Timmar", "Kategori", "Beskrivning", "Debiterbar"],
    ];
    periodEntries.forEach((entry) => {
      const project = projects.find((p) => p.id === entry.projectId);
      rows.push([
        entry.date,
        project?.customerName ?? "",
        project?.title ?? "Okänt projekt",
        Number(entry.hours).toString(),
        entry.category,
        entry.description ?? "",
        entry.isBillable !== false ? "Ja" : "Nej",
      ]);
    });

    const totalHours = periodEntries.reduce((s, e) => s + Number(e.hours), 0);
    const billableHours = periodEntries
      .filter((e) => e.isBillable !== false && isBillableCategory(e.category))
      .reduce((s, e) => s + Number(e.hours), 0);
    rows.push([]);
    rows.push(["Total timmar", "", "", totalHours.toString(), "", "", ""]);
    rows.push(["Debiterbar tid", "", "", billableHours.toString(), "", "", ""]);

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          })
          .join(",")
      )
      .join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tidsrapport${fileSuffix()}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Tidsrapport exporterad");
  }, [startDate, endDate, getFilteredEntries, fileSuffix, projects]);

  const handlePdf = useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error("Välj period");
      return;
    }
    const periodEntries = getFilteredEntries();
    if (periodEntries.length === 0) {
      toast.error("Inga tidregistreringar för det valda urvalet");
      return;
    }

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.text(safeSettings.reportHeaderName || safeSettings.companyName, 20, 20);
      doc.setFontSize(14);
      doc.text("Tidsrapport", 20, 30);

      doc.setFontSize(10);
      doc.text(`Period: ${startDate} - ${endDate}`, 20, 45);

      let filterY = 52;
      if (customerId !== "all") {
        const customer = customers.find((c) => c.id === customerId);
        if (customer) {
          doc.text(`Kund: ${customer.name}`, 20, filterY);
          filterY += 7;
        }
      }
      if (projectId !== "all") {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          doc.text(`Projekt: ${project.title}`, 20, filterY);
          filterY += 7;
        }
      }

      const tableBody = periodEntries.map((entry) => {
        const project = projects.find((p) => p.id === entry.projectId);
        return [
          entry.date,
          project?.customerName ?? "",
          project?.title ?? "Okänt projekt",
          Number(entry.hours).toString(),
          entry.category,
          entry.description ?? "",
          entry.isBillable !== false ? "Ja" : "Nej",
        ];
      });

      const totalHours = periodEntries.reduce((s, e) => s + Number(e.hours), 0);
      const billableHours = periodEntries
        .filter((e) => e.isBillable !== false && isBillableCategory(e.category))
        .reduce((s, e) => s + Number(e.hours), 0);

      autoTable(doc, {
        startY: filterY + 1,
        head: [["Datum", "Kund", "Projekt", "Timmar", "Kategori", "Beskrivning", "Debiterbar"]],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });

      const summaryY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont(undefined as any, "bold");
      doc.text(`Total timmar: ${totalHours}`, 20, summaryY);
      doc.text(`Debiterbar tid: ${billableHours}`, 20, summaryY + 7);

      drawReportFooter(doc, safeSettings.reportFooter);

      doc.save(`tidsrapport${fileSuffix()}-${startDate}-${endDate}.pdf`);
      toast.success("Tidsrapport PDF exporterad");
    } catch {
      toast.error("Kunde inte generera PDF");
    }
  }, [startDate, endDate, customerId, projectId, getFilteredEntries, fileSuffix, customers, projects, safeSettings]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Exportera</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportera tidsrapport</DialogTitle>
          <DialogDescription>
            Tidregistreringar för en period — filtrera per kund eller projekt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kund</Label>
            <Select value={customerId} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kunder</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Projekt / uppdrag</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {customerId === "all" ? "Alla projekt" : "Alla projekt för kunden"}
                </SelectItem>
                {filterProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                    {customerId === "all" ? ` (${p.customerName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Från</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Till</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleCsv}
              disabled={!startDate || !endDate}
            >
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button onClick={handlePdf} disabled={!startDate || !endDate}>
              <FileText className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
