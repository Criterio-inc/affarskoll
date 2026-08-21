import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { savedCalculations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const calculations = await db
      .select()
      .from(savedCalculations)
      .where(eq(savedCalculations.userId, userId))
      .orderBy(desc(savedCalculations.createdAt));

    return NextResponse.json(calculations);
  } catch (error) {
    console.error("Error fetching saved calculations:", error);
    return NextResponse.json({ error: "Failed to fetch saved calculations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const [calculation] = await db
      .insert(savedCalculations)
      .values({
        ...body,
        userId,
      })
      .returning();

    return NextResponse.json(calculation, { status: 201 });
  } catch (error) {
    console.error("Error creating saved calculation:", error);
    return NextResponse.json({ error: "Failed to create saved calculation" }, { status: 500 });
  }
}
