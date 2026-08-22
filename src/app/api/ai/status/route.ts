import { NextResponse } from "next/server";

// Talar om ifall AI-funktionerna är påslagna, dvs. om ANTHROPIC_API_KEY är
// satt i miljön. Klienten döljer AI-ytorna (chatt + momstolkning) helt när
// nyckeln saknas, så appen fungerar fullt ut utan AI-konto.
export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}
