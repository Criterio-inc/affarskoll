// Delad moms-deadline-modell. En enda källa för momsdeklarationens
// deklarationstillfällen och deadlines, så momslogg, notifikationer och
// ekonomiöversikten räknar likadant.
//
// Svenska deadlines (aktiebolag, små bolag utan EU-handel):
// - Kvartal: Q1 → 12 maj, Q2 → 17 aug, Q3 → 12 nov, Q4 → 12 feb (året efter)
// - Helår (årsmoms): i anslutning till INK2, omkring 1–17 augusti året efter
// - Månad: 26:e i månaden efter perioden
//
// Övergång helår → kvartal: när man byter mitt under året buntar SKV de
// kvartal vars deadline redan passerat med nästa kommande deadline. För ett
// byte efter 12 maj betyder det att Q1 och Q2 deklareras tillsammans 17 aug.

export type VatReportingPeriod = "monthly" | "quarterly" | "yearly";

export interface VatOccasion {
  /** Stabil nyckel, t.ex. "2026-Q1Q2". */
  key: string;
  /** Visningsetikett, t.ex. "Q1+Q2 2026" eller "Helår 2025". */
  label: string;
  /** Kvartal som tillfället täcker (1–4), om relevant. */
  quarters?: number[];
  /** Första månad (0-indexerad, inklusive) i redovisningsperioden. */
  startMonth: number;
  /** Sista månad (0-indexerad, inklusive). */
  endMonth: number;
  /** Deadline som ISO-datum "YYYY-MM-DD". */
  deadline: string;
  /** Ev. förklarande not (t.ex. övergångsregeln). */
  note?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Standard kvartalsdeadline (ISO) för ett givet kvartal och år. */
function quarterlyDeadline(quarter: number, year: number): string {
  switch (quarter) {
    case 1:
      return `${year}-05-12`;
    case 2:
      return `${year}-08-17`;
    case 3:
      return `${year}-11-12`;
    default:
      return `${year + 1}-02-12`;
  }
}

/**
 * Deklarationstillfällen för ett år givet redovisningsperiod.
 *
 * @param firstQuarterlyYear Året man övergick till kvartalsmoms. För det året
 *   buntas Q1+Q2 till 17 augusti (övergångsregeln). Lämna undefined om ej känt.
 */
export function getVatOccasions(
  year: number,
  period: VatReportingPeriod,
  firstQuarterlyYear?: number | null
): VatOccasion[] {
  if (period === "yearly") {
    return [
      {
        key: `${year}-FY`,
        label: `Helår ${year}`,
        startMonth: 0,
        endMonth: 11,
        deadline: `${year + 1}-08-17`,
        note: "Deklareras i anslutning till INK2, omkring 1–17 augusti.",
      },
    ];
  }

  if (period === "monthly") {
    return Array.from({ length: 12 }, (_, m) => {
      // Deadline 26:e i månaden efter perioden.
      const dlYear = m === 11 ? year + 1 : year;
      const dlMonth = m === 11 ? 1 : m + 2; // 1-indexerad månad
      return {
        key: `${year}-M${pad(m + 1)}`,
        label: `${pad(m + 1)}/${year}`,
        startMonth: m,
        endMonth: m,
        deadline: `${dlYear}-${pad(dlMonth)}-26`,
      };
    });
  }

  // Kvartal
  const isTransition =
    firstQuarterlyYear != null && year === firstQuarterlyYear;

  if (isTransition) {
    return [
      {
        key: `${year}-Q1Q2`,
        label: `Q1+Q2 ${year}`,
        quarters: [1, 2],
        startMonth: 0,
        endMonth: 5,
        deadline: `${year}-08-17`,
        note: "Övergång till kvartalsmoms: Q1 och Q2 deklareras tillsammans senast 17 augusti.",
      },
      {
        key: `${year}-Q3`,
        label: `Q3 ${year}`,
        quarters: [3],
        startMonth: 6,
        endMonth: 8,
        deadline: quarterlyDeadline(3, year),
      },
      {
        key: `${year}-Q4`,
        label: `Q4 ${year}`,
        quarters: [4],
        startMonth: 9,
        endMonth: 11,
        deadline: quarterlyDeadline(4, year),
      },
    ];
  }

  return [1, 2, 3, 4].map((q) => ({
    key: `${year}-Q${q}`,
    label: `Q${q} ${year}`,
    quarters: [q],
    startMonth: (q - 1) * 3,
    endMonth: (q - 1) * 3 + 2,
    deadline: quarterlyDeadline(q, year),
  }));
}

/** True om ett ISO-datum (YYYY-MM-DD) faller inom tillfällets period (samma år). */
export function eventInOccasion(
  eventDateIso: string,
  occasion: VatOccasion,
  year: number
): boolean {
  const [y, m] = eventDateIso.split("-").map(Number);
  if (y !== year) return false;
  const month0 = (m ?? 1) - 1;
  return month0 >= occasion.startMonth && month0 <= occasion.endMonth;
}

/**
 * Returnerar nästa kommande tillfälle (deadline >= today) bland en lista,
 * annars null. `todayIso` ges in för testbarhet/SSR-säkerhet.
 */
export function nextUpcomingOccasion(
  occasions: VatOccasion[],
  todayIso: string
): VatOccasion | null {
  const upcoming = occasions
    .filter((o) => o.deadline >= todayIso)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  return upcoming[0] ?? null;
}

const MONTHS_SV = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

/** Formatterar ISO-datum till "17 aug 2026". */
export function formatDeadlineSv(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SV[(m ?? 1) - 1]} ${y}`;
}
