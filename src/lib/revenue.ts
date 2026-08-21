// Delad intäktsmodell för dashboarden. Används av Översiktens KPI:er,
// intäktsdiagrammet, faktureringskön och intäkt-per-uppdrag-widgeten så att
// alla räknar likadant (annars driftar de tre ställena isär).

import type { Project } from "@/types/project";

export interface ProjectPeriodHours {
  /** Totala timmar i perioden (alla kategorier). */
  total: number;
  /** Debiterbara timmar i perioden (exkl. ej_debiterbar / isBillable=false). */
  billable: number;
}

/**
 * Bruttointäkt för ett projekt givet arbetade timmar i en period.
 *
 * - timpris: debiterbara timmar × timpris
 * - fastpris / fastpris_overtid: fastpriset proportionerligt mot budget
 *   (andel = totala timmar i perioden / budgeterade timmar)
 * - blandat: proportionerlig fastprisdel + debiterbara timmar × timpris
 *
 * Fastpris kräver budgeterade timmar > 0 för att kunna periodiseras.
 */
export function grossRevenueForProject(
  project: Pick<
    Project,
    "contractType" | "hourlyRate" | "fixedPrice" | "budgetedHours"
  >,
  hours: ProjectPeriodHours
): number {
  const contractType = project.contractType;
  const hourlyRate = Number(project.hourlyRate ?? 0);
  const fixedPrice = Number(project.fixedPrice ?? 0);
  const budgetedHours = Number(project.budgetedHours ?? 0);

  if (contractType === "timpris") {
    return hours.billable * hourlyRate;
  }

  // OBS medveten förenkling: fastpris_overtid behandlas här som ren
  // upplupen fastpris (timmar/budget × fastpris) UTAN övertidskomponent,
  // eftersom funktionen ofta anropas med periodtimmar där "vilka timmar
  // ligger över budget" inte går att avgöra. Uppdragssidans livstidsvy
  // använder projectEarnedRevenue() nedan, som räknar övertiden — vid
  // överskriden budget visar den därför (korrekt) mer än vyerna här.
  if (contractType === "fastpris" || contractType === "fastpris_overtid") {
    if (budgetedHours > 0) {
      return fixedPrice * (hours.total / budgetedHours);
    }
    return 0;
  }

  if (contractType === "blandat") {
    let gross = 0;
    if (budgetedHours > 0 && fixedPrice > 0) {
      gross += fixedPrice * (hours.total / budgetedHours);
    }
    gross += hours.billable * hourlyRate;
    return gross;
  }

  return 0;
}

/**
 * Effektiv Förmedlingsprovisionssats för ett projekt. 0 om uppdraget är undantaget
 * (provisionen borttagen), annars den globala satsen.
 */
export function effectiveCommissionRate(
  project: Pick<Project, "brokerCommissionExempt">,
  globalRate: number
): number {
  return project.brokerCommissionExempt ? 0 : globalRate;
}

/**
 * Nettointäkt för ett projekt efter Förmedlingsprovision. Provisionen dras bara av
 * om uppdraget inte är undantaget. Använd överallt där netto per uppdrag räknas.
 */
export function netRevenueForProject(
  project: Pick<
    Project,
    | "contractType"
    | "hourlyRate"
    | "fixedPrice"
    | "budgetedHours"
    | "brokerCommissionExempt"
  >,
  hours: ProjectPeriodHours,
  globalCommissionRate: number
): number {
  const gross = grossRevenueForProject(project, hours);
  return gross * (1 - effectiveCommissionRate(project, globalCommissionRate));
}

/**
 * Intjänad total intäkt (brutto) för ett uppdrag hittills — för lönsamhet och
 * "värde"-vyer (inte månadsperiodisering). Skiljer sig från grossRevenueForProject
 * som periodiserar fastpris per månad.
 *
 * - timpris: debiterbara timmar × pris
 * - fastpris: hela fastpriset (faktureras oavsett nedlagd tid)
 * - fastpris_overtid: fastpriset + timmar ÖVER budget × timpris (övertiden)
 * - blandat: fastpris + debiterbara timmar × pris
 */
export function projectEarnedRevenue(
  project: Pick<
    Project,
    "contractType" | "hourlyRate" | "fixedPrice" | "budgetedHours"
  >,
  hours: ProjectPeriodHours
): number {
  const rate = Number(project.hourlyRate ?? 0);
  const fixed = Number(project.fixedPrice ?? 0);
  const budget = Number(project.budgetedHours ?? 0);
  switch (project.contractType) {
    case "timpris":
      return hours.billable * rate;
    case "blandat":
      return fixed + hours.billable * rate;
    case "fastpris":
      return fixed;
    case "fastpris_overtid":
      return fixed + Math.max(0, hours.total - budget) * rate;
    default:
      return 0;
  }
}

/** True om kategorin/posten räknas som debiterbar mot kund. */
export function isBillableEntry(entry: {
  isBillable?: boolean;
  category: string;
}): boolean {
  return entry.isBillable !== false && entry.category !== "ej_debiterbar";
}

/** ISO-månadsnyckel "YYYY-MM" för ett Date. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
