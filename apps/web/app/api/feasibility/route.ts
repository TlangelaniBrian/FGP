import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/lib/portal-auth";
import {
  calculateTrustedFeasibility,
  FeasibilityWorkerError,
  feasibilityInputSchema,
} from "@/lib/feasibility-server";

export async function POST(req: NextRequest) {
  if (!await getAuthenticatedActor(req)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = feasibilityInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    return NextResponse.json(await calculateTrustedFeasibility(parsed.data));
  } catch (error) {
    if (error instanceof FeasibilityWorkerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Zoning rules could not be loaded" }, { status: 503 });
  }
}
