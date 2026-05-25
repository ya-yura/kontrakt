"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/auth/dev-auth";
import { createPrismaSavedFilterStore } from "@/src/saved-filters/prisma-store";
import {
  actionFailure,
  createSavedFilterForUser,
  deleteSavedFilterForUser,
  duplicateNameFailure,
  unknownFailure,
  updateSavedFilterForUser,
  type ActionResult,
  type DeleteSavedFilterData,
  type SavedFilterMutationData
} from "@/src/saved-filters/service";
import type { SavedFilterInput, UpdateSavedFilterInput } from "@/src/saved-filters/schemas";

const WATCHLISTS_PATH = "/watchlists";

function isDuplicateNamePrismaError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function mapActionError(error: unknown): ActionResult<never> {
  if (isDuplicateNamePrismaError(error)) {
    return duplicateNameFailure();
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
