import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { projectTemplates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(projectTemplates)
      .where(eq(projectTemplates.userId, userId))
      .orderBy(desc(projectTemplates.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching project templates:", error);
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
    if (!body?.name || !body?.templateData) {
      return NextResponse.json(
        { error: "name and templateData required" },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(projectTemplates)
      .values({
        userId,
        name: body.name,
        templateData: body.templateData,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Error creating project template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
