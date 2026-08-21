import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { calculatorPortfolios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [existing] = await db
      .select()
      .from(calculatorPortfolios)
      .where(eq(calculatorPortfolios.userId, userId));

    if (existing) {
      return NextResponse.json(existing);
    }

    // Create default empty portfolio if none exists
    const [created] = await db
      .insert(calculatorPortfolios)
      .values({
        userId,
        assignments: [],
      })
      .returning();

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const [existing] = await db
      .select()
      .from(calculatorPortfolios)
      .where(eq(calculatorPortfolios.userId, userId));

    if (existing) {
      const [updated] = await db
        .update(calculatorPortfolios)
        .set({
          assignments: body.assignments,
          updatedAt: new Date(),
        })
        .where(eq(calculatorPortfolios.userId, userId))
        .returning();

      return NextResponse.json(updated);
    }

    // Create if doesn't exist
    const [created] = await db
      .insert(calculatorPortfolios)
      .values({
        userId,
        assignments: body.assignments,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error updating portfolio:", error);
    return NextResponse.json({ error: "Failed to update portfolio" }, { status: 500 });
  }
}
