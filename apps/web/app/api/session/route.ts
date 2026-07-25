import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/lib/portal-auth";

export async function GET(request: Request) {
  const actor = await getAuthenticatedActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json(actor);
}
