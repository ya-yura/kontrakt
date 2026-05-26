"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/auth/dev-auth";
import { getPrismaClient } from "@/src/lib/prisma";
import { createPrismaSavedFilterStore } from "@/src/saved-filters/prisma-store";
import {
  actionFailure,
  createSavedFilterForUser,
  deleteSavedFilterForUser,
  duplicateNameFailure,
  notFoundFailure,
  toSavedFilterView,
  unknownFailure,
  updateSavedFilterForUser,
  validationFailure,
  type ActionResult,
  type DeleteSavedFilterData,
  type SavedFilterMutationData
} from "@/src/saved-filters/service";
import {
  savedFilterIdSchema,
  type SavedFilterInput,
  type UpdateSavedFilterInput
} from "@/src/saved-filters/schemas";
import {
  runWatchlists,
  WatchlistRunAlreadyInProgressError,
  type WatchlistRunSummary
} from "@/src/watchlists/run-watchlists";

const WATCHLISTS_PATH = "/watchlists";
const TENDERS_PATH = "/tenders";

function isDuplicateNamePrismaError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function mapActionError(error: unknown): ActionResult<never> {
  if (isDuplicateNamePrismaError(error)) {
    return duplicateNameFailure();
  }

  if (error instanceof WatchlistRunAlreadyInProgressError) {
    return actionFailure("RUN_IN_PROGRESS", "Запуск watchlists уже выполняется.");
  }

  return unknownFailure();
}

async function getAuthenticatedUserId(): Promise<ActionResult<{ userId: string }>> {
  const user = await auth();

  if (!user?.id) {
    return actionFailure("UNAUTHORIZED", "Нужно войти в систему.");
  }

  return {
    ok: true,
    data: {
      userId: user.id
    }
  };
}

export async function createSavedFilter(
  input: SavedFilterInput
): Promise<ActionResult<SavedFilterMutationData>> {
  try {
    const authResult = await getAuthenticatedUserId();

    if (!authResult.ok) {
      return authResult;
    }

    const result = await createSavedFilterForUser(
      createPrismaSavedFilterStore(),
      authResult.data.userId,
      input
    );

    if (result.ok) {
      revalidatePath(WATCHLISTS_PATH);
    }

    return result;
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateSavedFilter(
  input: UpdateSavedFilterInput
): Promise<ActionResult<SavedFilterMutationData>> {
  try {
    const authResult = await getAuthenticatedUserId();

    if (!authResult.ok) {
      return authResult;
    }

    const result = await updateSavedFilterForUser(
      createPrismaSavedFilterStore(),
      authResult.data.userId,
      input
    );

    if (result.ok) {
      revalidatePath(WATCHLISTS_PATH);
    }

    return result;
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deleteSavedFilter(
  filterId: string
): Promise<ActionResult<DeleteSavedFilterData>> {
  try {
    const authResult = await getAuthenticatedUserId();

    if (!authResult.ok) {
      return authResult;
    }

    const result = await deleteSavedFilterForUser(
      createPrismaSavedFilterStore(),
      authResult.data.userId,
      filterId
    );

    if (result.ok) {
      revalidatePath(WATCHLISTS_PATH);
    }

    return result;
  } catch (error) {
    return mapActionError(error);
  }
}

export type ManualWatchlistRunData = {
  filterId: string;
  filter: SavedFilterMutationData["filter"];
  summary: WatchlistRunSummary;
};

export async function runSavedFilterNow(
  filterId: string
): Promise<ActionResult<ManualWatchlistRunData>> {
  try {
    const parsed = savedFilterIdSchema.safeParse(filterId);

    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    const authResult = await getAuthenticatedUserId();

    if (!authResult.ok) {
      return authResult;
    }

    const prisma = getPrismaClient();
    const existing = await prisma.savedFilter.findFirst({
      where: {
        id: parsed.data,
        userId: authResult.data.userId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return notFoundFailure();
    }

    const summary = await runWatchlists({
      prisma,
      filterId: parsed.data,
      userId: authResult.data.userId,
      useLock: true
    });
    const updated = await prisma.savedFilter.findUnique({
      where: {
        id: parsed.data
      },
      select: {
        id: true,
        userId: true,
        name: true,
        query: true,
        isActive: true,
        lastRunAt: true,
        lastCursor: true,
        lastResultCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!updated) {
      return notFoundFailure();
    }

    revalidatePath(WATCHLISTS_PATH);
    revalidatePath(TENDERS_PATH);

    return {
      ok: true,
      data: {
        filterId: parsed.data,
        filter: toSavedFilterView(updated),
        summary
      }
    };
  } catch (error) {
    if (error instanceof WatchlistRunAlreadyInProgressError) {
      return actionFailure("RUN_IN_PROGRESS", "Запуск watchlists уже выполняется.");
    }

    return actionFailure("RUN_FAILED", "Не удалось запустить watchlist.");
  }
}
