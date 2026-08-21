// Fakturagenerator (PDF) — klassisk svensk fakturalayout: logotyp uppe till
// vänster (eller företagsnamnet i text), FAKTURA-block till höger,
// radtabell, summering med öresavrundning, betal-QR och bolagssidfot.
//
// createInvoiceDoc är ren och synkron (testbar i Node); downloadInvoicePdf
// är klientwrappern som laddar logotyp + QR och triggar nedladdning.

import type { jsPDF } from "jspdf";
import type { AppSettings } from "@/lib/settings";
import {
  type InvoiceLine,
  type InvoiceBuyerDetails,
  type TimeReportData,
  lineAmount,
  sumLines,
  round2,
} from "@/types/invoice";

export type { TimeReportEntry, TimeReportData } from "@/types/invoice";

export interface InvoicePdfInput {
  invoiceNumber: number;
  issueDate: string; // ISO
  dueDate: string | null;
  buyerName: string;
  buyerDetails: InvoiceBuyerDetails | null;
  invoiceLines: InvoiceLine[];
  vatRate: number; // 0.25 osv
  invoiceText: string | null;
  actualAmount: number; // fallback-belopp om rader saknas
  paymentTermsDays: number | null;
  // Tidrapport som bilagesidor efter fakturan (utelämna/tom = ingen bilaga)
  timeReport?: TimeReportData | null;
}

export interface InvoicePdfAssets {
  logoDataUrl?: string | null; // PNG med transparens
  qrDataUrl?: string | null; // betal-QR ("QR-kod för bankapp")
}

// "131 835,00" — svensk sifferform med vanliga mellanslag (jsPDF-säkert)
const fmtAmount = (n: number): string =>
  n
    .toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");

const fmtQty = (n: number): string =>
  Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("sv-SE", { maximumFractionDigits: 2 }).replace(/[  ]/g, " ");

const compactPostal = (s: string): string => s.replace(/\s+/g, "");

// Betal-QR enligt den svenska faktura-QR-standarden (usingQR) — läses av
// bankappar. Beloppet är det öresavrundade "att betala".
export function buildInvoiceQrPayload(
  input: InvoicePdfInput,
  settings: AppSettings
): string {
  const totals = computeTotals(input);
  return JSON.stringify({
    uqr: 1,
    tp: 1,
    nme: settings.companyName,
    cid: settings.companyOrgNumber,
    iref: String(input.invoiceNumber),
    idt: input.issueDate.replaceAll("-", ""),
    ddt: (input.dueDate ?? input.issueDate).replaceAll("-", ""),
    due: totals.totalRounded,
    pt: "BG",
    acc: settings.companyBankgiro,
  });
}

export function computeTotals(input: InvoicePdfInput) {
  const net =
    input.invoiceLines.length > 0 ? sumLines(input.invoiceLines) : round2(input.actualAmount);
  const vat = round2(net * input.vatRate);
  const totalExact = round2(net + vat);
  const totalRounded = Math.round(totalExact);
  const rounding = round2(totalRounded - totalExact);
  return { net, vat, totalExact, totalRounded, rounding };
}

export function createInvoiceDoc(
  doc: jsPDF,
  input: InvoicePdfInput,
  settings: AppSettings,
  assets: InvoicePdfAssets = {}
): jsPDF {
  const M_LEFT = 21;
  const M_RIGHT = 196; // högerkant för högerställd text
  const COL2_X = 111; // FAKTURA-blockets vänsterkant
  const COL3_X = 163; // Fakturanummer/Förfallodatum-kolumnen
  const { net, vat, totalRounded, rounding } = computeTotals(input);
  const b = input.buyerDetails ?? {};

  const label = (text: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(text, x, y);
  };
  const value = (text: string, x: number, y: number, size = 9.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.text(text, x, y);
  };

  // Logotyp (bevara bildens proportioner, bredd 26 mm)
  if (assets.logoDataUrl) {
    try {
      const props = doc.getImageProperties(assets.logoDataUrl);
      const w = 26;
      const h = (props.height / props.width) * w;
      doc.addImage(assets.logoDataUrl, "PNG", M_LEFT, 14, w, h);
    } catch {
      // trasig bilddata — fakturan funkar utan logotyp
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(settings.companyName, M_LEFT, 22);
  }

  // FAKTURA-blocket
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FAKTURA", COL2_X, 16);

  label("Fakturadatum", COL2_X, 24);
  value(input.issueDate, COL2_X, 29);
  label("Fakturanummer", COL3_X, 24);
  value(String(input.invoiceNumber), COL3_X, 29);

  let y = 37;
  if (b.reference) {
    label("Er referens", COL2_X, y);
    value(b.reference, COL2_X, y + 5);
    y += 13;
  }

  label("Köpare", COL2_X, y);
  y += 5;
  const buyerLines = [
    input.buyerName,
    b.street ?? null,
    b.postalCode || b.city ? `${b.postalCode ?? ""} ${b.city ?? ""}`.trim() : null,
    b.country ?? null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  for (const line of buyerLines) {
    value(line, COL2_X, y);
    y += 5;
  }

  // Leveransadress (vänsterspalten) — tom = samma som fakturaadressen
  const deliveryLines = (
    b.deliveryAddress && b.deliveryAddress.trim().length > 0
      ? b.deliveryAddress.split("\n")
      : buyerLines.slice(1)
  ).filter((l) => l.trim().length > 0);
  if (deliveryLines.length > 0) {
    label("Leveransadress", M_LEFT, 72);
    let dy = 77;
    for (const line of deliveryLines) {
      value(line, M_LEFT, dy);
      dy += 5;
    }
  }

  // Betalningsvillkor + förfallodatum + F-skatt
  const villkorY = Math.max(y + 8, 88);
  if (input.paymentTermsDays != null) {
    label("Betalningsvillkor", COL2_X, villkorY);
    value(`${input.paymentTermsDays} dagar`, COL2_X, villkorY + 5);
  }
  if (input.dueDate) {
    label("Förfallodatum", COL3_X, villkorY);
    value(input.dueDate, COL3_X, villkorY + 5);
  }
  if (settings.approvedForFSkatt) {
    label("Godkänd för F-skatt", COL2_X, villkorY + 13);
  }

  // Radtabell
  const QTY_X = 124; // "Antal" centreras hit
  const PRICE_X = 158; // "À-pris" högerställs hit
  const drawTableHeader = (ty: number): number => {
    doc.setDrawColor(60);
    doc.setLineWidth(0.4);
    doc.line(M_LEFT, ty, M_RIGHT, ty);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Benämning", M_LEFT + 1, ty + 5.5);
    doc.text("Antal", QTY_X, ty + 5.5, { align: "center" });
    doc.text("À-pris", PRICE_X, ty + 5.5, { align: "right" });
    doc.text("Summa", M_RIGHT - 1, ty + 5.5, { align: "right" });
    doc.setLineWidth(0.2);
    doc.line(M_LEFT, ty + 8, M_RIGHT, ty + 8);
    return ty + 8;
  };

  const lines: InvoiceLine[] =
    input.invoiceLines.length > 0
      ? input.invoiceLines
      : [
          {
            id: "fallback",
            description: "Konsultuppdrag",
            quantity: 1,
            unit: "st",
            unitPrice: round2(input.actualAmount),
          },
        ];

  let ty = drawTableHeader(124);
  for (const line of lines) {
    if (ty > 235) {
      doc.addPage();
      ty = drawTableHeader(30);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const desc = doc.splitTextToSize(line.description, 80) as string[];
    doc.text(desc, M_LEFT + 1, ty + 6);
    doc.text(`${fmtQty(line.quantity)} ${line.unit}`.trim(), QTY_X, ty + 6, {
      align: "center",
    });
    doc.text(fmtAmount(line.unitPrice), PRICE_X, ty + 6, { align: "right" });
    doc.text(fmtAmount(lineAmount(line)), M_RIGHT - 1, ty + 6, { align: "right" });
    const rowH = 4 + desc.length * 4.5;
    doc.setDrawColor(200);
    doc.setLineWidth(0.15);
    doc.line(M_LEFT, ty + rowH + 1.5, M_RIGHT, ty + rowH + 1.5);
    ty += rowH + 1.5;
  }

  // Summering (höger) + QR (vänster)
  let sy = ty + 10;
  if (sy > 240) {
    doc.addPage();
    sy = 30;
  }
  const SUM_LABEL_X = 105;
  const sumRow = (
    text: string,
    amount: string,
    yy: number,
    opts: { boldLabel?: boolean; boldValue?: boolean } = {}
  ) => {
    doc.setFont("helvetica", opts.boldLabel ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.text(text, SUM_LABEL_X, yy);
    doc.setFont("helvetica", opts.boldValue ? "bold" : "normal");
    doc.text(amount, M_RIGHT - 1, yy, { align: "right" });
  };
  sumRow("Belopp exklusive moms", fmtAmount(net), sy, { boldValue: true });
  sumRow(
    `Moms ${Math.round(input.vatRate * 100)} %`,
    fmtAmount(vat),
    sy + 7,
    { boldValue: true }
  );
  sumRow("Öresavrundning", fmtAmount(rounding), sy + 14);
  sumRow("Summa att betala (SEK)", fmtAmount(totalRounded), sy + 22, {
    boldLabel: true,
    boldValue: true,
  });

  if (assets.qrDataUrl) {
    try {
      doc.addImage(assets.qrDataUrl, "PNG", M_LEFT, sy - 4, 20, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text("QR-kod för bankapp", M_LEFT + 10, sy + 19, { align: "center" });
      doc.setTextColor(0);
    } catch {
      // trasig QR-data — hoppa över
    }
  }

  // Fritextrad (slutkund, avtal, period)
  if (input.invoiceText && input.invoiceText.trim().length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const freeLines = doc.splitTextToSize(input.invoiceText, 170) as string[];
    doc.text(freeLines, M_LEFT, sy + 36);
  }

  // Tidrapport som bilaga (sidfot och sidnumrering läggs på efteråt)
  if (input.timeReport && input.timeReport.entries.length > 0) {
    drawTimeReportAppendix(doc, input, M_LEFT, M_RIGHT);
  }

  // Sidfot + sidnummer på varje sida
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawFooter(doc, settings, M_LEFT, M_RIGHT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Sida ${p}/${pageCount}`, M_RIGHT, 10, { align: "right" });
  }

  return doc;
}

// Bilagan: tidrapporten bakom fakturan — samma typografi och sidfot,
// en rad per tidspost, summarad som ska stämma mot fakturans antal.
function drawTimeReportAppendix(
  doc: jsPDF,
  input: InvoicePdfInput,
  left: number,
  right: number
) {
  const report = input.timeReport!;
  const COL2_X = 111;
  const HOURS_X = right - 1;
  const TEXT_X = 55;

  doc.addPage();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TIDRAPPORT", left, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text(`Bilaga till faktura ${input.invoiceNumber}`, left, 26);
  doc.setTextColor(0);

  // Metablock till höger (samma stil som fakturans label/value)
  const meta: Array<[string, string]> = [];
  if (report.projectTitle) meta.push(["Uppdrag", report.projectTitle]);
  if (report.customerName) meta.push(["Slutkund", report.customerName]);
  if (report.periodStart && report.periodEnd)
    meta.push(["Period", `${report.periodStart} – ${report.periodEnd}`]);
  let my = 16;
  for (const [l, v] of meta) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(l, COL2_X, my);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(v, COL2_X, my + 4.5);
    my += 11;
  }

  const drawHeader = (ty: number): number => {
    doc.setDrawColor(60);
    doc.setLineWidth(0.4);
    doc.line(left, ty, right, ty);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Datum", left + 1, ty + 5.5);
    doc.text("Beskrivning", TEXT_X, ty + 5.5);
    doc.text("Timmar", HOURS_X, ty + 5.5, { align: "right" });
    doc.setLineWidth(0.2);
    doc.line(left, ty + 8, right, ty + 8);
    return ty + 8;
  };

  const sorted = [...report.entries].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  let y = drawHeader(Math.max(my + 2, 38));
  for (const entry of sorted) {
    const textLines = doc.splitTextToSize(entry.text || "—", 108) as string[];
    const rowH = 2.4 + textLines.length * 4.0;
    // Reservera plats för summaraden så den aldrig hamnar ensam på en ny sida
    if (y + rowH + 12 > 262) {
      doc.addPage();
      y = drawHeader(24);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(entry.date, left + 1, y + 5);
    doc.text(textLines, TEXT_X, y + 5);
    doc.text(fmtQty(entry.hours), HOURS_X, y + 5, { align: "right" });
    doc.setDrawColor(200);
    doc.setLineWidth(0.15);
    doc.line(left, y + rowH + 1.2, right, y + rowH + 1.2);
    y += rowH + 1.2;
  }

  const totalHours = sorted.reduce((s, e) => s + (Number(e.hours) || 0), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Summa", left + 1, y + 7);
  doc.text(`${fmtQty(round2(totalHours))} timmar`, HOURS_X, y + 7, {
    align: "right",
  });
}

function drawFooter(
  doc: jsPDF,
  settings: AppSettings,
  left: number,
  right: number
) {
  const topY = 271;
  doc.setDrawColor(60);
  doc.setLineWidth(0.4);
  doc.line(left, topY, right, topY);

  const small = (text: string, x: number, y: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(6.5);
    doc.text(text, x, y);
  };

  const c1 = left;
  const c2 = 67;
  const c3 = 113;
  const c4 = 168;
  let y1 = topY + 5;

  small(settings.companyName, c1, y1, true);
  small(settings.companyStreet.toUpperCase(), c1, y1 + 3.5);
  small(
    `${compactPostal(settings.companyPostalCode)} ${settings.companyCity.toUpperCase()}`,
    c1,
    y1 + 7
  );
  small(settings.companyCountry, c1, y1 + 10.5);

  small("Organisationsnr.", c2, y1, true);
  small(settings.companyOrgNumber, c2, y1 + 3.5);
  small("Momsregistreringsnr.", c2, y1 + 8, true);
  small(settings.companyVatNumber, c2, y1 + 11.5);

  small("Telefon", c3, y1, true);
  small(settings.invoicePhone, c3, y1 + 3.5);
  small("E-post", c3, y1 + 8, true);
  small(settings.invoiceEmail, c3, y1 + 11.5);
  small("Webbsida", c3, y1 + 16, true);
  small(settings.companyWebsite, c3, y1 + 19.5);

  small("Bankgiro", c4, y1, true);
  small(settings.companyBankgiro, c4, y1 + 3.5);
}

// Klient: bygg och ladda ner fakturan som PDF.
export async function downloadInvoicePdf(
  input: InvoicePdfInput,
  settings: AppSettings
): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });

  const [logoDataUrl, qrDataUrl] = await Promise.all([
    Promise.resolve(settings.companyLogoDataUrl || null),
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        return await QRCode.toDataURL(buildInvoiceQrPayload(input, settings), {
          margin: 0,
          width: 512,
          errorCorrectionLevel: "M",
        });
      } catch {
        return null;
      }
    })(),
  ]);

  createInvoiceDoc(doc, input, settings, { logoDataUrl, qrDataUrl });
  doc.save(`Faktura_${input.invoiceNumber}.pdf`);
}
