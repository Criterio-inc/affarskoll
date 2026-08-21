import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

const NUMERIC_FIELDS = ["km", "ratePerKm", "parkingSek", "tollsSek", "otherSek"];

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
      .from(trips)
      .where(and(eq(trips.id, id), eq(trips.userId, userId)));

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json({ error: "Failed to fetch trip" }, { status: 500 });
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

    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    for (const f of NUMERIC_FIELDS) {
      if (updates[f] !== undefined && updates[f] !== null)
        updates[f] = String(updates[f]);
    }

    const [row] = await db
      .update(trips)
      .set(updates)
      .where(and(eq(trips.id, id), eq(trips.userId, userId)))
      .returning();

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    console.error("Error updating trip:", error);
    return NextResponse.json(
      { error: "Failed to update trip" },
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
      .delete(trips)
      .where(and(eq(trips.id, id), eq(trips.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting trip:", error);
    return NextResponse.json(
      { error: "Failed to delete trip" },
      { status: 500 }
    );
  }
}
