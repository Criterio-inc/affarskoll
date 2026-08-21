import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { timeEntries } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const entries = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.userId, userId))
      .orderBy(desc(timeEntries.date));

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = stripProtected(await req.json());

    // Auto-set isBillable från kategorin ENDAST om den inte skickats med
    // explicit — så användarens manuella av/på-markering respekteras.
    const isBillable =
      body.isBillable !== undefined
        ? body.isBillable
        : body.category !== "ej_debiterbar";

    const [entry] = await db
      .insert(timeEntries)
      .values({
        ...body,
        userId,
        isBillable,
      })
      .returning();

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating time entry:", error);
    return NextResponse.json({ error: "Failed to create time entry" }, { status: 500 });
  }
}
