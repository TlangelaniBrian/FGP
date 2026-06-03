import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  address: z.string().min(1).max(500),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zone_code: z.string().min(1).max(20),
  size_sqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unit_type: z.enum(["bachelor", "1bed", "2bed"]),
  target_units: z.number().int().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";
  const res = await fetch(`${workerUrl}/analyze/feasibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
