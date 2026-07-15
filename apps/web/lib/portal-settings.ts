import { z } from "zod";

const booleanSettingSchema = z.boolean();
const scoreThresholdSchema = z.number().int().min(50).max(95);

const scraperSettingsSchema = z
  .object({
    property24: z.boolean(),
    private_property: z.boolean(),
    propdata: z.boolean(),
    gumtree: z.boolean(),
    immo_africa: z.boolean(),
    entegral: z.boolean(),
  })
  .strict();

export const portalSettingsSchema = z
  .object({
    autoAnalyze: booleanSettingSchema,
    scoreThreshold: scoreThresholdSchema,
    email: booleanSettingSchema,
    whatsapp: booleanSettingSchema,
    weekly: booleanSettingSchema,
    digest: booleanSettingSchema,
    scrapers: scraperSettingsSchema,
  })
  .strict();

export type PortalSettings = z.infer<typeof portalSettingsSchema>;

export const DEFAULT_PORTAL_SETTINGS = {
  autoAnalyze: true,
  scoreThreshold: 75,
  email: true,
  whatsapp: true,
  weekly: false,
  digest: true,
  scrapers: {
    property24: true,
    private_property: true,
    propdata: false,
    gumtree: false,
    immo_africa: true,
    entegral: true,
  },
} satisfies PortalSettings;

export function mergePortalSettings(
  rows: { key: string; value: unknown }[],
): PortalSettings {
  const settings: PortalSettings = {
    ...DEFAULT_PORTAL_SETTINGS,
    scrapers: { ...DEFAULT_PORTAL_SETTINGS.scrapers },
  };

  for (const row of rows) {
    if (row.key === "scoreThreshold") {
      const parsed = scoreThresholdSchema.safeParse(row.value);
      if (parsed.success) settings.scoreThreshold = parsed.data;
      continue;
    }

    if (row.key === "scrapers") {
      const parsed = scraperSettingsSchema.safeParse(row.value);
      if (parsed.success) settings.scrapers = parsed.data;
      continue;
    }

    if (
      row.key === "autoAnalyze" ||
      row.key === "email" ||
      row.key === "whatsapp" ||
      row.key === "weekly" ||
      row.key === "digest"
    ) {
      const parsed = booleanSettingSchema.safeParse(row.value);
      if (parsed.success) settings[row.key] = parsed.data;
    }
  }

  return settings;
}
