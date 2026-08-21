import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invoicePackages, vatEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [row] = await db
      .select()
      .from(invoicePackages)
      .where(
        and(eq(invoicePackages.id, id), eq(invoicePackages.userId, userId))
      );

    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(row);
  } catch (error) {
    console.error("Error fetching invoice package:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice package" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = stripProtected(await req.json());

    // Löpnumret sätts av POST-routen och får aldrig ändras i efterhand
    delete body.invoiceNumber;

    // Konvertera numeriska fält till string för Drizzle numeric
    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.actualAmount !== undefined)
      updates.actualAmount = String(body.actualAmount);
    if (body.theoreticalAmount !== undefined)
      updates.theoreticalAmount = String(body.theoreticalAmount);
    if (body.vatRate !== undefined) updates.vatRate = String(body.vatRate);
    if (body.vatAmount !== undefined)
      updates.vatAmount = String(body.vatAmount);
    if (body.totalInclVat !== undefined)
      updates.totalInclVat = String(body.totalInclVat);
    if (body.paymentTermsDays !== undefined)
      updates.paymentTermsDays =
        body.paymentTermsDays != null ? Number(body.paymentTermsDays) : null;

    const [row] = await db
      .update(invoicePackages)
      .set(updates)
      .where(
        and(eq(invoicePackages.id, id), eq(invoicePackages.userId, userId))
      )
      .returning();

    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(row);
  } catch (error) {
    console.error("Error updating invoice package:", error);
    return NextResponse.json(
      { error: "Failed to update invoice package" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Ta bort ev. auto-skapad moms-händelse kopplad till paketet, så
    // momsloggen inte blir kvar med en föräldralös post.
    await db
      .delete(vatEvents)
      .where(
        and(
          eq(vatEvents.invoicePackageId, id),
          eq(vatEvents.userId, userId)
        )
      );

    await db
      .delete(invoicePackages)
      .where(
        and(eq(invoicePackages.id, id), eq(invoicePackages.userId, userId))
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting invoice package:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice package" },
      { status: 500 }
    );
  }
}
