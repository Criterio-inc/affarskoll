// Typer och hjälpfunktioner för genererade fakturor.
// Löpnummerserien (730, 731, 732 ...) sätts av API:t vid skapande — aldrig i klienten.

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit: string; // "timmar" | "st" | ...
  unitPrice: number;
}

// Snapshot av köparens uppgifter när fakturan skapas — fakturan ska kunna
// återskapas exakt även om kundkortet ändras senare.
export interface InvoiceBuyerDetails {
  orgNumber?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  reference?: string | null; // "Er referens"
  deliveryAddress?: string | null; // flerradig; tom = samma som fakturaadress
}

// En rad i tidrapportbilagan. Fryses som snapshot på fakturan vid skapandet
// så att PDF:en alltid återskapas identiskt även om tidsposter ändras senare.
export interface TimeReportEntry {
  date: string; // ISO
  hours: number;
  text: string; // beskrivning eller kategorietikett
}

export interface TimeReportData {
  entries: TimeReportEntry[];
  projectTitle?: string | null;
  customerName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export const INVOICE_NUMBER_START = 730;
// Steg 1 enligt redovisningsbyrån (2026-08-21). Raderas den senaste fakturan
// återanvänds dess nummer, eftersom nästa alltid räknas från högsta befintliga.
export const INVOICE_NUMBER_STEP = 1;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const lineAmount = (line: InvoiceLine): number =>
  round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));

export const sumLines = (lines: InvoiceLine[]): number =>
  round2(lines.reduce((s, l) => s + lineAmount(l), 0));

let lineIdCounter = 0;
export const newLineId = (): string =>
  `line-${Date.now().toString(36)}-${(lineIdCounter++).toString(36)}`;

// "2026-06-01" → "260601" (formatet i fakturans fritextrad)
export const compactDate = (iso: string | null | undefined): string =>
  iso ? iso.slice(2).replaceAll("-", "") : "";
