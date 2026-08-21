import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { timesheetTemplates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(timesheetTemplates)
      .where(eq(timesheetTemplates.userId, userId))
      .orderBy(desc(timesheetTemplates.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching timesheet templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if (!body?.name || !body?.entries) {
      return NextResponse.json(
        { error: "name and entries required" },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(timesheetTemplates)
      .values({
        userId,
        name: body.name,
        entries: body.entries,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Error creating timesheet template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
