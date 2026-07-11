import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, teamMembers } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";
import { createAdminSupabase } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  if (!await getAuthenticatedActor(req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json(await db.select().from(teamMembers).orderBy(desc(teamMembers.invitedAt)));
}

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("team", req);
  if (guard.response) return guard.response;
  const body = await req.json() as { email?: string; name?: string; role?: string };
  if (!body.email || !body.name || !["Owner", "Chairperson", "Treasurer", "Analyst", "Viewer"].includes(body.role ?? "")) return NextResponse.json({ error: "email, name, and valid role are required" }, { status: 422 });
  let invitedUserId: string | undefined;
  const admin = createAdminSupabase();
  if (admin) {
    const invitation = await admin.auth.admin.inviteUserByEmail(body.email.toLowerCase(), { data: { full_name: body.name } });
    if (!invitation.error) invitedUserId = invitation.data.user?.id;
  }
  const [member] = await db.insert(teamMembers).values({ userId: invitedUserId, email: body.email.toLowerCase(), name: body.name, role: body.role!, status: "invited", invitedBy: guard.actor!.userId }).onConflictDoUpdate({ target: teamMembers.email, set: { userId: invitedUserId, name: body.name, role: body.role!, status: "invited", invitedBy: guard.actor!.userId } }).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "team_invite", title: `Invited ${member.name}`, detail: `${member.email} · ${member.role}`, entityType: "team_member", entityId: member.id });
  return NextResponse.json(member, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireSessionCapability("team", req);
  if (guard.response) return guard.response;
  const body = await req.json() as { id?: number; role?: string; status?: string };
  if (!body.id || (body.role && !["Owner", "Chairperson", "Treasurer", "Analyst", "Viewer"].includes(body.role)) || (body.status && !["invited", "active", "suspended"].includes(body.status))) return NextResponse.json({ error: "invalid team update" }, { status: 422 });
  const [member] = await db.update(teamMembers).set({ role: body.role, status: body.status }).where(eq(teamMembers.id, body.id)).returning();
  if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "team_update", title: `Updated ${member.name}`, detail: `${member.email} · ${member.role} · ${member.status}`, entityType: "team_member", entityId: member.id });
  return NextResponse.json(member);
}
