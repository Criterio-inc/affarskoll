// När en faktura markeras som betald skapar vi automatiskt en utgående moms-händelse.
// Detta är kritiskt vid kontantmetoden där moms räknas på betalningsdatum, inte fakturadatum.

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invoicePackages, vatEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const paidDate: string =
      body.paidDate ?? new Date().toISOString().slice(0, 10);

    // 1) Hämta fakturapaketet
    const [pkg] = await db
      .select()
      .from(invoicePackages)
      .where(
        and(eq(invoicePackages.id, id), eq(invoicePackages.userId, userId))
      );

    if (!pkg)
      return NextResponse.json(
        { error: "Faktureringspaket hittades inte" },
        { status: 404 }
      );

    if (pkg.status === "betald") {
      return NextResponse.json(
        { error: "Fakturan är redan markerad som betald" },
        { status: 400 }
      );
    }

    // 2) Uppdatera status och betalningsdatum
    const [updated] = await db
      .update(invoicePackages)
      .set({
        status: "betald",
        paidDate,
        updatedAt: new Date(),
      })
      .where(
        and(eq(invoicePackages.id, id), eq(invoicePackages.userId, userId))
      )
      .returning();

    // 3) Skapa utgående moms-händelse (om beloppet är momsbelagt)
    const vatAmount = Number(pkg.vatAmount ?? 0);
    const actualAmount = Number(pkg.actualAmount ?? 0);
    const vatRate = Number(pkg.vatRate ?? 0);

    // Momsdatum: om ett redovisningsdatum (vatDate) är satt på fakturan styr det
    // vilket år/kvartal momsen hamnar — annars betalningsdatumet. Detta gör att
    // decemberarbete som faktureras/betalas året efter kan redovisas på arbetsåret
    // (kundfordran), med momsen på det året.
    const vatEventDate: string = pkg.vatDate ?? paidDate;
    const accrued = pkg.vatDate != null && pkg.vatDate !== paidDate;

    // Skapa en försäljnings-momshändelse även vid 0 % (EU-omvänd/export, konto
    // 3105/3106) — den ska med i deklarationens rutor även utan utgående moms.
    let vatEventId: string | null = null;
    if (actualAmount > 0) {
      const [vatEvent] = await db
        .insert(vatEvents)
        .values({
          userId,
          eventDate: vatEventDate,
          description: `Faktura: ${pkg.projectTitle ?? pkg.customerName}${
            pkg.externalInvoiceNumber ? ` (${pkg.externalInvoiceNumber})` : ""
          }`,
          supplier: pkg.customerName,
          amountSek: String(actualAmount),
          vatRate: String(vatRate),
          outgoingVat: String(vatAmount),
          incomingVat: "0",
          eventType: "sales",
          basAccount: pkg.basAccount ?? "3001",
          invoicePackageId: pkg.id,
          notes: accrued
            ? `Auto-skapad från fakturapaket ${pkg.id}. Moms redovisad på ${vatEventDate} (kundfordran/arbetsår), betald ${paidDate}.`
            : `Auto-skapad från fakturapaket ${pkg.id}`,
        })
        .returning();
      vatEventId = vatEvent.id;
    }

    return NextResponse.json({
      ok: true,
      invoicePackage: updated,
      vatEventId,
    });
  } catch (error) {
    console.error("Error marking invoice as paid:", error);
    return NextResponse.json(
      { error: "Kunde inte markera som betald" },
      { status: 500 }
    );
  }
}
