import { ZodError } from "zod";
import {
  createSavedFilterInputSchema,
  deleteSavedFilterInputSchema,
  emptySavedFilterQuery,
  savedFilterQuerySchema,
  updateSavedFilterInputSchema,
  type SavedFilterInput,
  type SavedFilterQuery,
  type SavedFilterValues,
  type UpdateSavedFilterInput,
  type UpdateSavedFilterValues
} from "./schemas";

export type ActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
  | "RUN_IN_PROGRESS"
  | "RUN_FAILED"
  | "UNKNOWN_ERROR";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ActionError;
    };

export type SavedFilterRecord = {
  id: string;
  userId: string;
  name: string;
  query: unknown;
  isActive: boolean;
  lastRunAt: Date | string | null;
  lastCursor: string | null;
  lastResultCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type SavedFilterOwnerRecord = {
  id: string;
  userId: string;
  name: string;
};

export type SavedFilterView = {
  id: string;
  name: string;
  query: SavedFilterQuery;
  isActive: boolean;
  lastRunAt: string | null;
  lastCursor: string | null;
  lastResultCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedFilterMutationData = {
  filter: SavedFilterView;
};

export type DeleteSavedFilterData = {
  filterId: string;
};

export type SavedFilterWriteData = {
  name: string;
  query: SavedFilterQuery;
};

export type SavedFilterCreateData = SavedFilterWriteData & {
  userId: string;
};

export type SavedFilterStore = {
  findById(filterId: string): Promise<SavedFilterOwnerRecord | null>;
  findByUserAndName(userId: string, name: string): Promise<SavedFilterOwnerRecord | null>;
  create(data: SavedFilterCreateData): Promise<SavedFilterRecord>;
  updateOwned(
    userId: string,
    filterId: string,
    data: SavedFilterWriteData
  ): Promise<SavedFilterRecord | null>;
  deleteOwned(userId: string, filterId: string): Promise<boolean>;
};

export function actionFailure(code: ActionErrorCode, message: string): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function duplicateNameFailure(): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "DUPLICATE_NAME",
      message: "Фильтр с таким названием уже существует.",
      fieldErrors: {
        name: ["Выберите другое название"]
      }
    }
  };
}

export function validationFailure(error: ZodError): ActionResult<never> {
  const flattened = error.flatten();
  const rawFieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors = Object.fromEntries(
    Object.entries(rawFieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0
    )
  ) as Record<string, string[]>;

  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Проверьте поля фильтра.",
      fieldErrors
    }
  };
}

export function unknownFailure(): ActionResult<never> {
  return actionFailure("UNKNOWN_ERROR", "Не удалось сохранить фильтр. Попробуйте еще раз.");
}

export function notFoundFailure(): ActionResult<never> {
  return actionFailure("NOT_FOUND", "Фильтр не найден или недоступен.");
}

function toIsoDate(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString();
}

function toNullableIsoDate(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : value.toISOString();
}

export function normalizeSavedFilterQuery(query: unknown): SavedFilterQuery {
  const parsed = savedFilterQuerySchema.safeParse(query);
  return parsed.success ? parsed.data : emptySavedFilterQuery;
}

export function toSavedFilterView(record: SavedFilterRecord): SavedFilterView {
  return {
    id: record.id,
    name: record.name,
    query: normalizeSavedFilterQuery(record.query),
    isActive: record.isActive,
    lastRunAt: toNullableIsoDate(record.lastRunAt),
    lastCursor: record.lastCursor,
    lastResultCount: record.lastResultCount,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt)
  };
}

function buildSavedFilterQuery(input: SavedFilterValues | UpdateSavedFilterValues): SavedFilterQuery {
  return {
    searchQuery: input.searchQuery,
    includeKeywords: input.includeKeywords,
    excludeKeywords: input.excludeKeywords,
    okpd2Prefixes: input.okpd2Prefixes,
    regionCodes: input.regionCodes,
    methodAllowList: input.methodAllowList,
    customerInnAllowList: input.customerInnAllowList,
    customerInnBlockList: input.customerInnBlockList,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    daysAhead: input.daysAhead,
    onlyWithSecurity: input.onlyWithSecurity,
    onlyForMsp: input.onlyForMsp,
    notifyOnNew: input.notifyOnNew,
    notifyOnChanges: input.notifyOnChanges,
    notifyEmail: input.notifyEmail,
    notifyTelegram: input.notifyTelegram,
    alertPreferences: input.alertPreferences
  };
}

export async function createSavedFilterForUser(
  store: SavedFilterStore,
  userId: string,
  input: SavedFilterInput
): Promise<ActionResult<SavedFilterMutationData>> {
  const parsed = createSavedFilterInputSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const existing = await store.findByUserAndName(userId, parsed.data.name);

  if (existing) {
    return duplicateNameFailure();
  }

  const created = await store.create({
    userId,
    name: parsed.data.name,
    query: buildSavedFilterQuery(parsed.data)
  });

  return {
    ok: true,
    data: {
      filter: toSavedFilterView(created)
    }
  };
}

export async function updateSavedFilterForUser(
  store: SavedFilterStore,
  userId: string,
  input: UpdateSavedFilterInput
): Promise<ActionResult<SavedFilterMutationData>> {
  const parsed = updateSavedFilterInputSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const existing = await store.findById(parsed.data.filterId);

  if (!existing || existing.userId !== userId) {
    return notFoundFailure();
  }

  const duplicate = await store.findByUserAndName(userId, parsed.data.name);

  if (duplicate && duplicate.id !== parsed.data.filterId) {
    return duplicateNameFailure();
  }

  const updated = await store.updateOwned(userId, parsed.data.filterId, {
    name: parsed.data.name,
    query: buildSavedFilterQuery(parsed.data)
  });

  if (!updated) {
    return notFoundFailure();
  }

  return {
    ok: true,
    data: {
      filter: toSavedFilterView(updated)
    }
  };
}

export async function deleteSavedFilterForUser(
  store: SavedFilterStore,
  userId: string,
  filterId: string
): Promise<ActionResult<DeleteSavedFilterData>> {
  const parsed = deleteSavedFilterInputSchema.safeParse({ filterId });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const existing = await store.findById(parsed.data.filterId);

  if (!existing || existing.userId !== userId) {
    return notFoundFailure();
  }

  const deleted = await store.deleteOwned(userId, parsed.data.filterId);

  if (!deleted) {
    return notFoundFailure();
  }

  return {
    ok: true,
    data: {
      filterId: parsed.data.filterId
    }
  };
}
