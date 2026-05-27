import { z } from "zod";

const MAX_NAME_LENGTH = 80;
const MAX_SEARCH_LENGTH = 500;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 120;

function normalizeListValue(value: unknown) {
  const rawItems =
    typeof value === "string"
      ? value.split(/[\n,;]+/)
      : Array.isArray(value)
        ? value
        : value == null || value === ""
          ? []
          : value;

  if (!Array.isArray(rawItems)) {
    return rawItems;
  }

  const seen = new Set<string>();
  const normalized: unknown[] = [];

  for (const item of rawItems) {
    if (typeof item !== "string") {
      normalized.push(item);
      continue;
    }

    const trimmed = item.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeNullableNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");

    if (!normalized) {
      return null;
    }

    return Number(normalized);
  }

  return value;
}

function normalizeBoolean(value: unknown) {
  if (value === true || value === false) {
    return value;
  }

  if (value == null || value === "") {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "on", "yes"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "off", "no"].includes(normalized)) {
      return false;
    }
  }

  return value;
}

function normalizeOptionalBoolean(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }

  return normalizeBoolean(value);
}

const textListSchema = z.preprocess(
  normalizeListValue,
  z
    .array(
      z
        .string()
        .min(1, "Значение не должно быть пустым")
        .max(MAX_LIST_ITEM_LENGTH, `Не длиннее ${MAX_LIST_ITEM_LENGTH} символов`)
    )
    .max(MAX_LIST_ITEMS, `Не больше ${MAX_LIST_ITEMS} значений`)
    .default([])
);

const nullableMoneySchema = z.preprocess(
  normalizeNullableNumber,
  z
    .number()
    .finite("Введите число")
    .nonnegative("Значение не может быть отрицательным")
    .nullable()
    .default(null)
);

const daysAheadSchema = z.preprocess(
  normalizeNullableNumber,
  z
    .number()
    .int("Введите целое число дней")
    .min(0, "Не меньше 0 дней")
    .max(365, "Не больше 365 дней")
    .nullable()
    .default(null)
);

const booleanFlagSchema = z.preprocess(normalizeBoolean, z.boolean().default(false));
const emailNotificationFlagSchema = z.preprocess(normalizeOptionalBoolean, z.boolean().default(true));

const alertPreferencesSchema = z.preprocess(
  (value) => (value == null || value === "" ? {} : value),
  z
    .object({
      notifyEmail: z.preprocess(normalizeOptionalBoolean, z.boolean().optional()),
      notifyTelegram: z.preprocess(normalizeOptionalBoolean, z.boolean().optional()),
      telegramChatId: z.string().trim().max(120, "Не длиннее 120 символов").optional()
    })
    .default({})
);

export const savedFilterIdSchema = z.string().trim().min(1, "Не указан фильтр");

export const savedFilterNameSchema = z
  .string()
  .trim()
  .min(1, "Название обязательно")
  .max(MAX_NAME_LENGTH, `Не длиннее ${MAX_NAME_LENGTH} символов`);

const savedFilterQueryShape = {
  searchQuery: z
    .string()
    .trim()
    .max(MAX_SEARCH_LENGTH, `Не длиннее ${MAX_SEARCH_LENGTH} символов`)
    .default(""),
  includeKeywords: textListSchema,
  excludeKeywords: textListSchema,
  okpd2Prefixes: textListSchema,
  regionCodes: textListSchema,
  methodAllowList: textListSchema,
  customerInnAllowList: textListSchema,
  customerInnBlockList: textListSchema,
  minPrice: nullableMoneySchema,
  maxPrice: nullableMoneySchema,
  daysAhead: daysAheadSchema,
  onlyWithSecurity: booleanFlagSchema,
  onlyForMsp: booleanFlagSchema,
  notifyOnNew: booleanFlagSchema,
  notifyOnChanges: booleanFlagSchema,
  notifyEmail: emailNotificationFlagSchema,
  notifyTelegram: booleanFlagSchema,
  alertPreferences: alertPreferencesSchema
};

function validatePriceRange(
  input: { minPrice: number | null; maxPrice: number | null },
  context: z.RefinementCtx
) {
  if (input.minPrice != null && input.maxPrice != null && input.minPrice > input.maxPrice) {
    context.addIssue({
      code: "custom",
      path: ["maxPrice"],
      message: "Максимальная цена должна быть не меньше минимальной"
    });
  }
}

export const savedFilterQuerySchema = z
  .object(savedFilterQueryShape)
  .superRefine(validatePriceRange);

const savedFilterInputBaseSchema = z.object({
  name: savedFilterNameSchema,
  ...savedFilterQueryShape
});

export const savedFilterInputSchema = savedFilterInputBaseSchema.superRefine(validatePriceRange);

export const createSavedFilterInputSchema = savedFilterInputSchema;

export const updateSavedFilterInputSchema = savedFilterInputBaseSchema
  .extend({
    filterId: savedFilterIdSchema
  })
  .superRefine(validatePriceRange);

export const deleteSavedFilterInputSchema = z.object({
  filterId: savedFilterIdSchema
});

export const emptySavedFilterQuery = savedFilterQuerySchema.parse({});

export type SavedFilterQuery = z.output<typeof savedFilterQuerySchema>;
export type SavedFilterInput = z.input<typeof savedFilterInputSchema>;
export type SavedFilterValues = z.output<typeof savedFilterInputSchema>;
export type UpdateSavedFilterInput = z.input<typeof updateSavedFilterInputSchema>;
export type UpdateSavedFilterValues = z.output<typeof updateSavedFilterInputSchema>;
