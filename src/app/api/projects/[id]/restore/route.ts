// D14: Återställ ett soft-deleted projekt (rensar deletedAt).
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [updated] = await db
      .update(projects)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error("Error restoring project:", error);
    return NextResponse.json(
      { error: "Failed to restore project" },
      { status: 500 }
    );
  }
}
