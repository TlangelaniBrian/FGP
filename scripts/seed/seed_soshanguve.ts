import { db, projects, projectBudgetItems, projectContacts, projectDecisions, milestones } from "@fgp/database";

async function main() {
  const [project] = await db.insert(projects).values({
    name: "Soshanguve Build",
    status: "planning",
    erfNumber: "14201",
    township: "Soshanguve South Extension 13",
    partners: ["Tlangelani Mkhabela", "Inathi Mdledle"],
    monthlySavingZar: "3000",
    phase1TargetZar: "210000",
    scenario: "base",
    notes: "ERF 14201, Soshanguve South Ext 13. Save-then-borrow strategy. Break ground Oct 2028.",
  }).returning();

  const pid = project.id;

  await db.insert(projectBudgetItems).values([
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Property Transfer",  unit: "Lump Sum", quantity: "1", unitCost: "15000", totalCost: "15000",  status: "estimate", timeline: "Apr-May 2026", notes: "Andrew Thomas estimate" },
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Building Plans",     unit: "Lump Sum", quantity: "1", unitCost: "10000", totalCost: "10000",  status: "estimate", timeline: "May-Jun 2026", notes: "Local draughtsman" },
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Municipal Fees",     unit: "Lump Sum", quantity: "1", unitCost: "3000",  totalCost: "3000",   status: "estimate", timeline: "Jun-Jul 2026", notes: "Soshanguve municipality" },
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Site Survey",        unit: "Lump Sum", quantity: "1", unitCost: "4000",  totalCost: "4000",   status: "estimate" },
    { projectId: pid, category: "SITE PREP",        item: "Clearing",           unit: "m²",       quantity: "200", unitCost: "30",  totalCost: "6000",   status: "estimate" },
    { projectId: pid, category: "SITE PREP",        item: "Excavation",         unit: "m³",       quantity: "20",  unitCost: "250", totalCost: "5000",   status: "estimate" },
    { projectId: pid, category: "FOUNDATIONS",      item: "Concrete",           unit: "m³",       quantity: "10",  unitCost: "2000",totalCost: "20000",  status: "estimate" },
    { projectId: pid, category: "FOUNDATIONS",      item: "Blocks",             unit: "each",     quantity: "800", unitCost: "12",  totalCost: "9600",   status: "estimate" },
    { projectId: pid, category: "FOUNDATIONS",      item: "Damp proof",         unit: "m",        quantity: "60",  unitCost: "40",  totalCost: "2400",   status: "estimate" },
    { projectId: pid, category: "WALLS",            item: "Bricks/Blocks",      unit: "each",     quantity: "4000",unitCost: "6",   totalCost: "24000",  status: "estimate" },
    { projectId: pid, category: "WALLS",            item: "Cement/Sand",        unit: "m³",       quantity: "5",   unitCost: "800", totalCost: "4000",   status: "estimate" },
    { projectId: pid, category: "ROOF",             item: "Timber",             unit: "m",        quantity: "200", unitCost: "80",  totalCost: "16000",  status: "estimate" },
    { projectId: pid, category: "ROOF",             item: "Sheeting",           unit: "m²",       quantity: "80",  unitCost: "180", totalCost: "14400",  status: "estimate" },
    { projectId: pid, category: "ROOF",             item: "Nails/Fittings",     unit: "Lump Sum", quantity: "1",   unitCost: "2000",totalCost: "2000",   status: "estimate" },
    { projectId: pid, category: "WINDOWS/DOORS",    item: "Windows",            unit: "each",     quantity: "4",   unitCost: "1500",totalCost: "6000",   status: "estimate" },
    { projectId: pid, category: "WINDOWS/DOORS",    item: "Doors",              unit: "each",     quantity: "6",   unitCost: "2000",totalCost: "12000",  status: "estimate" },
    { projectId: pid, category: "WINDOWS/DOORS",    item: "Security",           unit: "each",     quantity: "4",   unitCost: "800", totalCost: "3200",   status: "estimate" },
    { projectId: pid, category: "FLOOR",            item: "Concrete",           unit: "m²",       quantity: "60",  unitCost: "200", totalCost: "12000",  status: "estimate" },
    { projectId: pid, category: "FLOOR",            item: "Screed",             unit: "m²",       quantity: "60",  unitCost: "50",  totalCost: "3000",   status: "estimate" },
    { projectId: pid, category: "PLASTER",          item: "Internal",           unit: "m²",       quantity: "240", unitCost: "60",  totalCost: "14400",  status: "estimate" },
    { projectId: pid, category: "PLASTER",          item: "External",           unit: "m²",       quantity: "120", unitCost: "70",  totalCost: "8400",   status: "estimate" },
    { projectId: pid, category: "PAINT",            item: "Paint",              unit: "Litre",    quantity: "80",  unitCost: "120", totalCost: "9600",   status: "estimate" },
    { projectId: pid, category: "ELECTRICAL",       item: "Wiring",             unit: "Room",     quantity: "2",   unitCost: "5000",totalCost: "10000",  status: "estimate" },
    { projectId: pid, category: "ELECTRICAL",       item: "Fittings",           unit: "Lump Sum", quantity: "1",   unitCost: "3000",totalCost: "3000",   status: "estimate" },
    { projectId: pid, category: "PLUMBING",         item: "Basic plumbing",     unit: "Room",     quantity: "2",   unitCost: "8000",totalCost: "16000",  status: "estimate" },
    { projectId: pid, category: "PLUMBING",         item: "Sanitary",           unit: "Room",     quantity: "2",   unitCost: "5000",totalCost: "10000",  status: "estimate" },
    { projectId: pid, category: "EXTERNAL",         item: "Boundary",           unit: "m",        quantity: "50",  unitCost: "200", totalCost: "10000",  status: "estimate" },
    { projectId: pid, category: "EXTERNAL",         item: "Gate",               unit: "Set",      quantity: "1",   unitCost: "5000",totalCost: "5000",   status: "estimate" },
    { projectId: pid, category: "LABOUR",           item: "Skilled labour",     unit: "Days",     quantity: "40",  unitCost: "500", totalCost: "20000",  status: "estimate" },
    { projectId: pid, category: "LABOUR",           item: "General labour",     unit: "Days",     quantity: "60",  unitCost: "300", totalCost: "18000",  status: "estimate" },
    { projectId: pid, category: "CONTINGENCY",      item: "Unforeseen",         unit: "10%",      totalCost: "27900", status: "estimate", notes: "10% of R279,000" },
  ]);

  await db.insert(projectContacts).values([
    { projectId: pid, role: "Conveyancing Attorney", name: "Andrew Thomas Attorneys — Cassius Chauke", phone: "017 054 0005", email: "deeds@andrewthomas.co.za", status: "active" },
    { projectId: pid, role: "Co-Owner", name: "Inathi Mdledle", email: "inathimdledle@gmail.com", status: "active" },
    { projectId: pid, role: "Architect/Draughtsman", status: "pending", notes: "Need local Soshanguve/Gauteng based" },
    { projectId: pid, role: "Contractor", status: "pending", notes: "Get 3 quotes, check CIDB rating" },
  ]);

  await db.insert(projectDecisions).values([
    { projectId: pid, decidedAt: "2026-04-01", decision: "Minimum Viable Shell strategy — Phase 1 = watertight shell only", rationale: "Both have full-time jobs; smaller scope = faster completion and less contractor risk" },
    { projectId: pid, decidedAt: "2026-04-01", decision: "Monthly contribution set at R1,500 each (R3,000 combined)", rationale: "Reflects realistic disposable income; leaves headroom for personal obligations" },
    { projectId: pid, decidedAt: "2026-04-01", decision: "Save-then-borrow strategy adopted", rationale: "At R3k/mo cash-only, Phase 1 takes 70 months. Borrow R150–180k against titled asset in 2028." },
    { projectId: pid, decidedAt: "2026-04-01", decision: "R20k lump sum (Inathi) treated as UNCONFIRMED — not in base plan", rationale: "Unconfirmed lump sums that enter base plan become crises when they don't arrive" },
    { projectId: pid, decidedAt: "2026-04-01", decision: "Groundbreaking target: Oct 2028 (base case)", rationale: "18–24 months savings for paperwork + 6 months loan process" },
  ]);

  await db.insert(milestones).values([
    { projectId: pid, targetDate: "2026-05-01", milestone: "Property transfer registers via Andrew Thomas Attorneys", status: "IN_PROGRESS", owner: "Tlangelani", isMajor: false },
    { projectId: pid, targetDate: "2026-05-01", milestone: "Open joint savings account — first R3,000 deposited", status: "IN_PROGRESS", owner: "Both", isMajor: false },
    { projectId: pid, targetDate: "2027-03-01", milestone: "★ Paperwork fully funded (~R30k spent). Plans approved.", status: "PENDING", owner: "Tlangelani", isMajor: true },
    { projectId: pid, targetDate: "2028-04-01", milestone: "★ Loan-ready — ~R39k balance, titled property, approved plans", status: "PENDING", owner: "Tlangelani", isMajor: true },
    { projectId: pid, targetDate: "2028-05-01", milestone: "Apply for building loan (R150–180k) — NHFC or commercial bank", status: "PENDING", owner: "Tlangelani", isMajor: false },
    { projectId: pid, targetDate: "2028-10-01", milestone: "★ BREAK GROUND — Phase 1a begins (watertight shell, R120k)", status: "PENDING", owner: "Inathi", isMajor: true },
    { projectId: pid, targetDate: "2029-09-01", milestone: "★ Phase 1 COMPLETE — unit rentable. First rental income.", status: "PENDING", owner: "Both", isMajor: true },
  ]);

  console.log(`Seeded Soshanguve project (id=${pid})`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
