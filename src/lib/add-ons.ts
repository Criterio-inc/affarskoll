// Tilläggstillfällen på uppdrag (extra utbildningsdagar o.d. utöver avtalet).
// Ett tillägg räknas som fakturerat när en icke-krediterad faktura har en rad
// med addOnId = tilläggets id. Krediteras fakturan blir tillägget ofakturerat igen.

import type { AddOnKind, Project, ProjectAddOn } from "@/types/project";
import type { InvoiceLine } from "@/types/invoice";

export const ADD_ON_DEFAULTS: Record<
  AddOnKind,
  { label: string; price: number; hours: number }
> = {
  halvdag: { label: "Halvdag", price: 9500, hours: 4 },
  heldag: { label: "Heldag", price: 18000, hours: 8 },
  annat: { label: "Annat", price: 0, hours: 0 },
};

export function projectAddOns(
  project: Pick<Project, "addOns"> | null | undefined
): ProjectAddOn[] {
  const list = project?.addOns;
  return Array.isArray(list) ? list : [];
}

export function addOnsTotal(addOns: ProjectAddOn[]): number {
  return addOns.reduce((s, a) => s + (Number(a.price) || 0), 0);
}

export function addOnsHours(addOns: ProjectAddOn[]): number {
  return addOns.reduce((s, a) => s + (Number(a.hours) || 0), 0);
}

interface PackageLike {
  projectId: string | null;
  status: string;
  invoiceLines: InvoiceLine[] | null;
  invoiceNumber?: number | null;
}

/** Tilläggs-id → fakturanummer (eller null) för fakturerade tillägg. */
export function invoicedAddOnMap(
  packages: PackageLike[],
  projectId: string
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const p of packages) {
    if (p.projectId !== projectId || p.status === "krediterad") continue;
    for (const l of p.invoiceLines ?? []) {
      if (l.addOnId) map.set(l.addOnId, p.invoiceNumber ?? null);
    }
  }
  return map;
}

export function addOnLineText(a: ProjectAddOn): string {
  const label = a.description.trim() || ADD_ON_DEFAULTS[a.kind].label;
  return `Tilläggstillfälle: ${label} ${a.date}`;
}
