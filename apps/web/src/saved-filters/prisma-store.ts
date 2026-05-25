import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/src/lib/prisma";
import type { SavedFilterQuery } from "./schemas";
import type {
  SavedFilterOwnerRecord,
  SavedFilterRecord,
  SavedFilterStore
} from "./service";

const savedFilterOwnerSelect = {
  id: true,
  userId: true,
  name: true
} satisfies Prisma.SavedFilterSelect;

const savedFilterRecordSelect = {
  id: true,
  userId: true,
  name: true,
  query: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.SavedFilterSelect;

function toPrismaJson(query: SavedFilterQuery): Prisma.InputJsonValue {
  return query as Prisma.InputJsonValue;
}

export function createPrismaSavedFilterStore(
  prisma: PrismaClient = getPrismaClient()
): SavedFilterStore {
  return {
    findById(filterId: string): Promise<SavedFilterOwnerRecord | null> {
      return prisma.savedFilter.findUnique({
        where: { id: filterId },
        select: savedFilterOwnerSelect
      });
    },

    findByUserAndName(userId: string, name: string): Promise<SavedFilterOwnerRecord | null> {
      return prisma.savedFilter.findFirst({
        where: {
          userId,
          name
        },
        select: savedFilterOwnerSelect
      });
    },

    create(data): Promise<SavedFilterRecord> {
      return prisma.savedFilter.create({
        data: {
          userId: data.userId,
          name: data.name,
          query: toPrismaJson(data.query)
        },
        select: savedFilterRecordSelect
      });
    },

    updateOwned(userId, filterId, data): Promise<SavedFilterRecord | null> {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.savedFilter.updateMany({
          where: {
            id: filterId,
            userId
          },
          data: {
            name: data.name,
            query: toPrismaJson(data.query)
          }
        });

        if (updated.count !== 1) {
          return null;
        }

        return tx.savedFilter.findUnique({
          where: { id: filterId },
          select: savedFilterRecordSelect
        });
      });
    },

    async deleteOwned(userId, filterId): Promise<boolean> {
      const deleted = await prisma.savedFilter.deleteMany({
        where: {
          id: filterId,
          userId
        }
      });

      return deleted.count === 1;
    }
  };
}
