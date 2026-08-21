import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { vatEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = { ...body };
    if (body.amountSek !== undefined)
      updates.amountSek = String(body.amountSek);
    if (body.vatRate !== undefined) updates.vatRate = String(body.vatRate);
    if (body.outgoingVat !== undefined)
      updates.outgoingVat = String(body.outgoingVat);
    if (body.incomingVat !== undefined)
      updates.incomingVat = String(body.incomingVat);

    const [row] = await db
      .update(vatEvents)
      .set(updates)
      .where(and(eq(vatEvents.id, id), eq(vatEvents.userId, userId)))
      .returning();

    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(row);
  } catch (error) {
    console.error("Error updating VAT event:", error);
    return NextResponse.json(
      { error: "Failed to update VAT event" },
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

    await db
      .delete(vatEvents)
      .where(and(eq(vatEvents.id, id), eq(vatEvents.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting VAT event:", error);
    return NextResponse.json(
      { error: "Failed to delete VAT event" },
      { status: 500 }
    );
  }
}
