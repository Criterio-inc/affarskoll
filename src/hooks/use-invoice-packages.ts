"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  InvoiceLine,
  InvoiceBuyerDetails,
  TimeReportEntry,
} from "@/types/invoice";

export type InvoiceStatus = "utkast" | "skickad" | "betald" | "krediterad";

export interface InvoicePackage {
  id: string;
  userId: string;
  customerId: string | null;
  customerName: string;
  projectId: string | null;
  projectTitle: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  theoreticalAmount: string;
  actualAmount: string;
  adjustmentReason: string | null;
  vatRate: string;
  vatAmount: string;
  totalInclVat: string;
  basAccount: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  vatDate: string | null;
  externalInvoiceNumber: string | null;
  invoiceNumber: number | null;
  invoiceLines: InvoiceLine[] | null;
  buyerName: string | null;
  buyerDetails: InvoiceBuyerDetails | null;
  invoiceText: string | null;
  paymentTermsDays: number | null;
  timeReportSnapshot: TimeReportEntry[] | null;
  linkedTimeEntryIds: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Tillåter både number och string för numeriska fält — API-routen castar till string för Drizzle numeric.
export type NewInvoicePackageInput = {
  customerId?: string | null;
  customerName: string;
  projectId?: string | null;
  projectTitle?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  theoreticalAmount?: number | string;
  actualAmount: number | string;
  adjustmentReason?: string | null;
  vatRate?: number | string;
  vatAmount?: number | string;
  totalInclVat?: number | string;
  basAccount?: string | null;
  status?: InvoiceStatus;
  issueDate?: string | null;
  dueDate?: string | null;
  paidDate?: string | null;
  externalInvoiceNumber?: string | null;
  linkedTimeEntryIds?: string[];
  notes?: string | null;
  // Genererad faktura
  assignInvoiceNumber?: boolean;      // true = servern sätter nästa löpnummer (730, +1)
  invoiceLines?: InvoiceLine[];
  buyerName?: string | null;
  buyerDetails?: InvoiceBuyerDetails | null;
  invoiceText?: string | null;
  paymentTermsDays?: number | null;
  timeReportSnapshot?: TimeReportEntry[];
};

export function useInvoicePackages() {
  return useQuery<InvoicePackage[]>({
    queryKey: ["invoice-packages"],
    queryFn: async () => {
      const res = await fetch("/api/invoice-packages");
      if (!res.ok) throw new Error("Kunde inte ladda fakturapaket");
      return res.json();
    },
  });
}

export function useInvoicePackage(id: string | null) {
  return useQuery<InvoicePackage>({
    queryKey: ["invoice-packages", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoice-packages/${id}`);
      if (!res.ok) throw new Error("Kunde inte ladda fakturapaketet");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateInvoicePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: NewInvoicePackageInput) => {
      const res = await fetch("/api/invoice-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte skapa fakturapaket");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-packages"] });
    },
  });
}

export function useUpdateInvoicePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<InvoicePackage> & { id: string }) => {
      const res = await fetch(`/api/invoice-packages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte uppdatera fakturapaket");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-packages"] });
    },
  });
}

export function useDeleteInvoicePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoice-packages/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte ta bort fakturapaket");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-packages"] });
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      paidDate,
    }: {
      id: string;
      paidDate?: string;
    }) => {
      const res = await fetch(`/api/invoice-packages/${id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidDate }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error ?? "Kunde inte markera som betald");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-packages"] });
      qc.invalidateQueries({ queryKey: ["vat-events"] });
    },
  });
}
