import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateUserNotifications } from "@/lib/notifications-generator";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await generateUserNotifications(userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating notifications:", error);
    return NextResponse.json(
      { error: "Failed to generate notifications" },
      { status: 500 }
    );
  }
}
