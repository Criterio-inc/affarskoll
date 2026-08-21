import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("sv-SE").format(num);
}

/**
 * Normalisera namn för jämförelse: trimma och gör gemener.
 * Skyddar mot att avslutande mellanslag eller olika skiftläge bryter
 * kund-/projektmatchning (t.ex. "Kundbolaget " vs "Kundbolaget").
 */
export function normalizeName(name?: string | null): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Avgör om ett projekt hör till en kund. Matchar i första hand på
 * customerId, annars på normaliserat namn. Använd överallt där projekt
 * filtreras per kund så matchningen blir robust.
 */
export function projectBelongsToCustomer(
  project: { customerId?: string | null; customerName?: string | null },
  customer: { id: string; name: string }
): boolean {
  if (project.customerId && project.customerId === customer.id) return true;
  return normalizeName(project.customerName) === normalizeName(customer.name);
}

export function formatPercent(num: number, decimals = 1): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return amount.toString();
}

/**
 * Calculate the number of calendar months an assignment spans (inclusive).
 * E.g. 2026-01-15 to 2026-03-20 = 3 months (Jan, Feb, Mar).
 */
export function calculateDurationMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return Math.max(1, months);
}

/**
 * Calculate the consultant's net value after broker commission.
 * Only deducts the commission rate (default 6%) per assignment.
 * The fixed monthly broker fee is a total cost, NOT per assignment.
 */
export function calculateNetAfterCommission(
  totalValue: number,
  commissionRate: number = 0,
): number {
  return totalValue * (1 - commissionRate);
}

/**
 * Calculate total assignment/project value based on contract type.
 */
export function calculateTotalValue(
  contractType: string,
  hours: number,
  hourlyRate: number,
  fixedPrice: number
): number {
  switch (contractType) {
    case "timpris":
      return hours * hourlyRate;
    case "fastpris":
      return fixedPrice;
    case "blandat":
      return fixedPrice + hours * hourlyRate;
    case "fastpris_overtid":
      return fixedPrice;
    default:
      return 0;
  }
}
