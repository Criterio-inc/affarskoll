import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { savedCalculations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const [updated] = await db
      .update(savedCalculations)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(savedCalculations.id, id), eq(savedCalculations.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Saved calculation not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating saved calculation:", error);
    return NextResponse.json({ error: "Failed to update saved calculation" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [deleted] = await db
      .delete(savedCalculations)
      .where(and(eq(savedCalculations.id, id), eq(savedCalculations.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Saved calculation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved calculation:", error);
    return NextResponse.json({ error: "Failed to delete saved calculation" }, { status: 500 });
  }
}
