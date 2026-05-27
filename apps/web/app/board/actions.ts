"use server";

import type { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/auth/dev-auth";
import { parseChecklistState, parseChecklistTemplate } from "@/src/board/checklist";
import {
  boardActionFailure,
  moveTenderToStageForUser,
  type ActionResult,
  type KanbanStageTargetRecord,
  type MovedTenderRecord,
  type MoveTenderStageData,
  type MoveTenderStageStore,
  type TenderStageOwnerRecord
} from "@/src/board/service";
import { getPrismaClient } from "@/src/lib/prisma";

const BOARD_PATH = "/board";

function createPrismaMoveTenderStageStore(prisma: PrismaClient): MoveTenderStageStore {
  return {
    async findOwnedTender(
      tenderId: string,
      userId: string
    ): Promise<TenderStageOwnerRecord | null> {
      return prisma.tender.findFirst({
        where: {
          id: tenderId,
          ownerId: userId
        },
        select: {
          id: true,
          ownerId: true,
          kanbanStageId: true,
          sourceStage: true,
          checklistState: true
        }
      }).then((tender) =>
        tender
          ? {
              ...tender,
              checklistState: parseChecklistState(tender.checklistState)
            }
          : null
      );
    },
    async findOwnedStage(stageCode: string, userId: string): Promise<KanbanStageTargetRecord | null> {
      return prisma.kanbanStage.findUnique({
        where: {
          ownerId_code: {
            ownerId: userId,
            code: stageCode
          }
        },
        select: {
          id: true,
          ownerId: true,
          code: true,
          name: true,
          checklistTemplate: true
        }
      }).then((stage) =>
        stage
          ? {
              ...stage,
              checklistTemplate: parseChecklistTemplate(stage.checklistTemplate)
            }
          : null
      );
    },
    async updateTenderStage(
      tenderId: string,
      kanbanStageId: string
    ): Promise<MovedTenderRecord> {
      return prisma.tender.update({
        where: {
          id: tenderId
        },
        data: {
          kanbanStageId
        },
        select: {
          id: true,
          kanbanStageId: true,
          sourceStage: true
        }
      });
    }
  };
}

export async function moveTenderToStage(
  tenderId: string,
  stageCode: string
): Promise<ActionResult<MoveTenderStageData>> {
  try {
    const user = await auth();

    if (!user?.id) {
      return boardActionFailure("UNAUTHORIZED", "Нужно войти в систему.");
    }

    const result = await moveTenderToStageForUser(
      createPrismaMoveTenderStageStore(getPrismaClient()),
      user.id,
      {
        tenderId,
        stageCode
      }
    );

    if (result.ok) {
      revalidatePath(BOARD_PATH);
      revalidatePath(`/tenders/${result.data.tenderId}`);
    }

    return result;
  } catch {
    return boardActionFailure("UNKNOWN_ERROR", "Не удалось переместить закупку.");
  }
}
