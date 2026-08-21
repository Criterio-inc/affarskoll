import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

/**
 * GET /api/projects — list active projects (soft-deleted excluded by default)
 * Lägg ?deleted=1 för att lista bara raderade (för återställa-vy).
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const showDeleted = url.searchParams.get("deleted") === "1";

    const userProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          showDeleted ? isNotNull(projects.deletedAt) : isNull(projects.deletedAt)
        )
      )
      .orderBy(desc(projects.createdAt));

    return NextResponse.json(userProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = stripProtected(await req.json());

    const [project] = await db
      .insert(projects)
      .values({
        ...body,
        userId,
      })
      .returning();

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
