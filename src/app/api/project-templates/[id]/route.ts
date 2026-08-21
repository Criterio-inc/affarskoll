import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { projectTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

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
      .delete(projectTemplates)
      .where(
        and(eq(projectTemplates.id, id), eq(projectTemplates.userId, userId))
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting project template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
