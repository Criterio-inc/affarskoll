"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type VatEventType =
  | "sales"
  | "purchase_se"
  | "purchase_eu"
  | "purchase_non_eu"
  | "reverse_charge"
  | "other";

export interface VatEvent {
  id: string;
  userId: string;
  eventDate: string;
  description: string;
  supplier: string | null;
  amountSek: string;
  vatRate: string;
  outgoingVat: string;
  incomingVat: string;
  eventType: VatEventType;
  basAccount: string | null;
  invoicePackageId: string | null;
  scenarioKey: string | null;
  notes: string | null;
  createdAt: string;
}

// Tillåter både number och string för numeriska fält — API-routen castar.
export type NewVatEventInput = {
  eventDate: string;
  description: string;
  supplier?: string | null;
  amountSek: number | string;
  vatRate?: number | string;
  outgoingVat?: number | string;
  incomingVat?: number | string;
  eventType?: VatEventType;
  basAccount?: string | null;
  invoicePackageId?: string | null;
  scenarioKey?: string | null;
  notes?: string | null;
};

export function useVatEvents(year?: number) {
  return useQuery<VatEvent[]>({
    queryKey: ["vat-events", year ?? "all"],
    queryFn: async () => {
      const url = year ? `/api/vat-events?year=${year}` : "/api/vat-events";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Kunde inte ladda moms-händelser");
      return res.json();
    },
  });
}

export function useCreateVatEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: NewVatEventInput) => {
      const res = await fetch("/api/vat-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte skapa moms-händelse");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vat-events"] });
    },
  });
}

// Update tar emot samma loose-typing som create — API-routen castar.
export type UpdateVatEventInput = {
  id: string;
  eventDate?: string;
  description?: string;
  supplier?: string | null;
  amountSek?: number | string;
  vatRate?: number | string;
  outgoingVat?: number | string;
  incomingVat?: number | string;
  eventType?: VatEventType;
  basAccount?: string | null;
  invoicePackageId?: string | null;
  scenarioKey?: string | null;
  notes?: string | null;
};

export function useUpdateVatEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateVatEventInput) => {
      const res = await fetch(`/api/vat-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte uppdatera moms-händelse");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vat-events"] });
    },
  });
}

export function useDeleteVatEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vat-events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte ta bort moms-händelse");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vat-events"] });
    },
  });
}

/**
 * Beräknar moms-saldo från en lista händelser.
 * Returnerar utgående, ingående och nettot att betala till SKV.
 */
export function calculateVatSummary(events: VatEvent[]) {
  let totalOutgoing = 0;
  let totalIncoming = 0;
  for (const e of events) {
    totalOutgoing += Number(e.outgoingVat ?? 0);
    totalIncoming += Number(e.incomingVat ?? 0);
  }
  const netToPay = totalOutgoing - totalIncoming;
  return {
    totalOutgoing: Math.round(totalOutgoing),
    totalIncoming: Math.round(totalIncoming),
    netToPay: Math.round(netToPay),
    eventCount: events.length,
  };
}
