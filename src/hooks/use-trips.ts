"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TripReceipt {
  name: string;
  dataUrl: string; // base64 data-URL
}

export interface Trip {
  id: string;
  userId: string;
  projectId: string | null;
  projectTitle: string | null;
  customerName: string | null;
  date: string;
  purpose: string | null;
  fromTo: string | null;
  km: string;
  roundTrip: boolean;
  ratePerKm: string;
  parkingSek: string;
  tollsSek: string;
  otherSek: string;
  receipts: TripReceipt[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Loose typing: numeriska fält kan skickas som number eller string — API castar.
export type TripInput = {
  projectId?: string | null;
  projectTitle?: string | null;
  customerName?: string | null;
  date: string;
  purpose?: string | null;
  fromTo?: string | null;
  km?: number | string;
  roundTrip?: boolean;
  ratePerKm?: number | string;
  parkingSek?: number | string;
  tollsSek?: number | string;
  otherSek?: number | string;
  receipts?: TripReceipt[];
  notes?: string | null;
};

export function useTrips(year?: number) {
  return useQuery<Trip[]>({
    queryKey: ["trips", year ?? "all"],
    queryFn: async () => {
      const url = year ? `/api/trips?year=${year}` : "/api/trips";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Kunde inte ladda resor");
      return res.json();
    },
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TripInput) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte spara resa");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: TripInput & { id: string }) => {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte uppdatera resa");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte ta bort resa");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

/**
 * On-site-andel per uppdrag, mätt på tid. On-site-dagar = dagar med en resa
 * kopplad till uppdraget (styrkt av kvitto); de dagarnas loggade timmar räknas
 * som on-site. Ger ett tidsvägt underlag för tjänsteställe-bedömningen.
 */
export function onSiteBreakdown(
  trips: { projectId: string | null; date: string }[],
  timeEntries: {
    projectId: string;
    date: string;
    hours: number | string;
    location?: string | null;
  }[],
  projectId: string,
  fromIso?: string,
  toIso?: string
): { onsiteHours: number; totalHours: number; share: number; onsiteDays: number } {
  // Underlaget räknar bara till och med i dag: tidrapporten kan innehålla
  // planerade framtida poster, och de är inte utfört arbete.
  const nu = new Date();
  const idag = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(nu.getDate()).padStart(2, "0")}`;
  const slut = !toIso || toIso > idag ? idag : toIso;
  const inRange = (d: string) => (!fromIso || d >= fromIso) && d <= slut;
  const resedagar = new Set(
    trips
      .filter((t) => t.projectId === projectId && inRange(t.date))
      .map((t) => t.date)
  );
  let onsiteHours = 0;
  let totalHours = 0;
  // On-site-dagar räknas ur tidrapporten, precis som timmarna: ett datum är
  // en on-site-dag när minst en tidspost det datumet bedöms som on-site.
  // Tidigare räknades resedagar rakt av, vilket gav fler dagar än de Pär
  // faktiskt angett som hos kund och gick isär med timsumman.
  const onsiteDagar = new Set<string>();
  for (const e of timeEntries) {
    if (e.projectId !== projectId || !inRange(e.date)) continue;
    const h = Number(e.hours) || 0;
    totalHours += h;
    // Faktiskt loggat arbetsställe styr; saknas det härleds det från resedag.
    const isOnsite = e.location
      ? e.location === "hos_kund"
      : resedagar.has(e.date);
    if (isOnsite) {
      onsiteHours += h;
      onsiteDagar.add(e.date);
    }
  }
  return {
    onsiteHours,
    totalHours,
    share: totalHours > 0 ? onsiteHours / totalHours : 0,
    onsiteDays: onsiteDagar.size,
  };
}

/** Faktisk körd sträcka: dubbel vid tur och retur (TOR). */
export function effectiveKm(trip: Pick<Trip, "km" | "roundTrip">): number {
  return Number(trip.km) * (trip.roundTrip ? 2 : 1);
}

/** Ersättning för en resa: effektiv km × sats + p-avgift + trängselskatt + övrigt. */
export function tripTotal(trip: Trip): {
  km: number;
  mileage: number;
  extras: number;
  total: number;
} {
  const km = effectiveKm(trip);
  const mileage = km * Number(trip.ratePerKm);
  const extras =
    Number(trip.parkingSek) + Number(trip.tollsSek) + Number(trip.otherSek);
  return { km, mileage, extras, total: mileage + extras };
}
