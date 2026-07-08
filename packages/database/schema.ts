import {
  pgTable, bigserial, text, numeric, integer, boolean,
  timestamp, date, serial, jsonb,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id"),
  listingId: bigserial("listing_id", { mode: "number" }),
  reportId: bigserial("report_id", { mode: "number" }),
  name: text("name"),
  status: text("status").default("planning"),
  notes: text("notes"),
  erfNumber: text("erf_number"),
  township: text("township"),
  partners: text("partners").array(),
  monthlySavingZar: numeric("monthly_saving_zar"),
  phase1TargetZar: numeric("phase1_target_zar"),
  scenario: text("scenario").default("base"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectBudgetItems = pgTable("project_budget_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  category: text("category").notNull(),
  item: text("item").notNull(),
  description: text("description"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  unitCost: numeric("unit_cost"),
  totalCost: numeric("total_cost"),
  actualCost: numeric("actual_cost"),
  status: text("status").default("estimate"),
  timeline: text("timeline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectContacts = pgTable("project_contacts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  role: text("role").notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  status: text("status").default("pending"),
  notes: text("notes"),
});

export const projectDecisions = pgTable("project_decisions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  decidedAt: date("decided_at").notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale"),
  impact: text("impact"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectCheckins = pgTable("project_checkins", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  weekOf: date("week_of").notNull(),
  attorneyStatus: text("attorney_status"),
  savingsConfirmed: boolean("savings_confirmed"),
  depositZar: numeric("deposit_zar"),
  supplierProgress: text("supplier_progress"),
  openIssues: text("open_issues"),
  actionsNextCall: text("actions_next_call"),
  decisionsNeeded: text("decisions_needed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const zoningSchemeRules = pgTable("zoning_scheme_rules", {
  id: serial("id").primaryKey(),
  municipality: text("municipality").notNull(),
  zoneCode: text("zone_code").notNull(),
  zoneLabel: text("zone_label"),
  maxUnitsPerHa: integer("max_units_per_ha"),
  maxUnitsPerErf: integer("max_units_per_erf"),
  coveragePct: numeric("coverage_pct"),
  far: numeric("far"),
  maxHeightM: numeric("max_height_m"),
  maxStoreys: integer("max_storeys"),
  buildingLineFrontM: numeric("building_line_front_m"),
  buildingLineSideM: numeric("building_line_side_m"),
  buildingLineRearM: numeric("building_line_rear_m"),
  permittedUses: text("permitted_uses").array(),
  consentUses: text("consent_uses").array(),
  rezoningPossibleTo: text("rezoning_possible_to").array(),
  rezoningDifficulty: text("rezoning_difficulty"),
  rezoningApprovalRate: numeric("rezoning_approval_rate"),
  formsRequired: text("forms_required").array(),
  schemeDocument: text("scheme_document"),
  schemeYear: integer("scheme_year"),
  lastUpdated: date("last_updated"),
});

export const feasibilityReports = pgTable("feasibility_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  listingId: bigserial("listing_id", { mode: "number" }).notNull(),
  userId: text("user_id"),
  unitType: text("unit_type").notNull(),
  targetUnits: integer("target_units").notNull(),
  buildRatePerSqm: numeric("build_rate_per_sqm").notNull().default("13500"),
  tariffYear: integer("tariff_year").notNull().default(2026),
  maxUnitsAllowed: integer("max_units_allowed"),
  maxBuildableSqm: numeric("max_buildable_sqm"),
  maxFootprintSqm: numeric("max_footprint_sqm"),
  rezoningRequired: boolean("rezoning_required").default(false),
  costLand: numeric("cost_land"),
  costBuild: numeric("cost_build"),
  costProfessionalFees: numeric("cost_professional_fees"),
  costBulkContributions: numeric("cost_bulk_contributions"),
  costTransferDuty: numeric("cost_transfer_duty"),
  costTotal: numeric("cost_total"),
  rentPerUnitMonthly: numeric("rent_per_unit_monthly"),
  grossMonthlyIncome: numeric("gross_monthly_income"),
  grossAnnualIncome: numeric("gross_annual_income"),
  yieldGrossPct: numeric("yield_gross_pct"),
  yieldAt85OccPct: numeric("yield_at_85_occ_pct"),
  viable: boolean("viable"),
  viabilityNotes: text("viability_notes"),
  pdfPackageUrl: text("pdf_package_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const listings = pgTable("listings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  source: text("source").notNull(),
  sourceId: text("source_id"),
  sourceUrl: text("source_url"),
  address: text("address"),
  suburb: text("suburb"),
  city: text("city"),
  municipality: text("municipality"),
  sizeSqm: numeric("size_sqm"),
  price: numeric("price"),
  listingType: text("listing_type").default("vacant_land"),
  description: text("description"),
  zoneCode: text("zone_code"),
  dolomiteRisk: text("dolomite_risk"),
  status: text("status").default("new"),
  feasibilityScore: integer("feasibility_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tariffs — DB-driven so build rates, rents, bulk contributions, transfer-duty
// brackets and fee config can be updated annually without a code deploy.
// One row per (tariff_year, category); `data` holds the category payload as JSON.
export const tariffs = pgTable("tariffs", {
  id: serial("id").primaryKey(),
  tariffYear: integer("tariff_year").notNull(),
  category: text("category").notNull(), // build_rates | unit_sizes | market_rents | bulk_contributions | transfer_duty_brackets | fees
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  targetDate: text("target_date").notNull(),
  milestone: text("milestone").notNull(),
  status: text("status").default("PENDING"),
  owner: text("owner"),
  isMajor: boolean("is_major").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
