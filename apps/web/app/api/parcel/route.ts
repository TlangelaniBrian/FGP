import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Proxy for the worker's POST /analyze/parcel spatial join. The worker owns the
// PostGIS query; this route just validates the coordinate and forwards it,
// surfacing worker errors (502 unreachable, 503 no PostGIS, 429 rate limited).
const schema = z.object({
  // Gauteng bounding-box guards mirror the worker's ParcelRequest.
  lat: z.number().min(-27).max(-25),
  lng: z.number().min(27).max(29.5),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/analyze/parcel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return NextResponse.json(
      { error: "Worker unreachable — is the FastAPI service running?" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => null);
    }
    // FastAPI uses { detail }, our routes use { error }; normalise to { error }.
    const message =
      detail && typeof detail === "object" && "detail" in detail
        ? (detail as { detail: unknown }).detail
        : detail;
    return NextResponse.json({ error: message ?? "Parcel analysis failed" }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
