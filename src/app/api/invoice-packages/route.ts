import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invoicePackages } from "@/lib/db/schema";
import { eq, desc, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";
import { INVOICE_NUMBER_START, INVOICE_NUMBER_STEP } from "@/types/invoice";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(invoicePackages)
      .where(eq(invoicePackages.userId, userId))
      .orderBy(desc(invoicePackages.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching invoice packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice packages" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = stripProtected(await req.json());

    // Löpnumret sätts alltid på serversidan — flaggan säger till, klienten
    // får aldrig skicka ett eget nummer.
    const assignNumber = body.assignInvoiceNumber === true;
    delete body.assignInvoiceNumber;
    delete body.invoiceNumber;

    // Beräkna momsbelopp om inte angivet
    const actualAmount = Number(body.actualAmount ?? 0);
    const vatRate = Number(body.vatRate ?? 0.25);
    const vatAmount =
      body.vatAmount !== undefined
        ? Number(body.vatAmount)
        : Math.round(actualAmount * vatRate * 100) / 100;
    const totalInclVat =
      body.totalInclVat !== undefined
        ? Number(body.totalInclVat)
        : Math.round((actualAmount + vatAmount) * 100) / 100;

    const values = {
      ...body,
      userId,
      actualAmount: String(actualAmount),
      vatRate: String(vatRate),
      vatAmount: String(vatAmount),
      totalInclVat: String(totalInclVat),
      theoreticalAmount:
        body.theoreticalAmount !== undefined
          ? String(body.theoreticalAmount)
          : "0",
      paymentTermsDays:
        body.paymentTermsDays != null ? Number(body.paymentTermsDays) : null,
    };

    if (!assignNumber) {
      const [row] = await db.insert(invoicePackages).values(values).returning();
      return NextResponse.json(row, { status: 201 });
    }

    // Serie: start 730, +1 per faktura (redovisningsbyråns krav). Nästa nummer
    // räknas från högsta befintliga, så raderas den senaste återanvänds dess
    // nummer. Unikt index (userId, invoiceNumber) fångar en ev. kapplöpning —
    // då läses max om och nästa nummer provas.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const [agg] = await db
        .select({ maxNumber: max(invoicePackages.invoiceNumber) })
        .from(invoicePackages)
        .where(eq(invoicePackages.userId, userId));
      const next =
        agg?.maxNumber != null
          ? Number(agg.maxNumber) + INVOICE_NUMBER_STEP
          : INVOICE_NUMBER_START;
      try {
        const [row] = await db
          .insert(invoicePackages)
          .values({ ...values, invoiceNumber: next })
          .returning();
        return NextResponse.json(row, { status: 201 });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("uq_invoice_packages_user_number")) throw err;
      }
    }
    throw lastError;
  } catch (error) {
    console.error("Error creating invoice package:", error);
    return NextResponse.json(
      { error: "Failed to create invoice package" },
      { status: 500 }
    );
  }
}
