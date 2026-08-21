import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { timeEntries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = stripProtected(await req.json());

    // Härled isBillable från kategori endast om kategorin ändras OCH ingen
    // explicit isBillable skickats med (annars respekteras manuell markering).
    if (body.category !== undefined && body.isBillable === undefined) {
      body.isBillable = body.category !== "ej_debiterbar";
    }

    const [updated] = await db
      .update(timeEntries)
      .set(body)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating time entry:", error);
    return NextResponse.json({ error: "Failed to update time entry" }, { status: 500 });
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
      .delete(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting time entry:", error);
    return NextResponse.json({ error: "Failed to delete time entry" }, { status: 500 });
  }
}
