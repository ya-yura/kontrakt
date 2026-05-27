"use server";

import { TenderDecision, type Prisma, type PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/auth/dev-auth";
import {
  boardActionFailure,
  updateTenderChecklistForUser,
  updateTenderOwnerCommentForUser,
  type ActionResult,
  type TenderChecklistOwnerRecord,
  type TenderOwnerCommentOwnerRecord,
  type UpdateTenderChecklistData,
  type UpdateTenderChecklistStore,
  type UpdateTenderOwnerCommentData,
  type UpdateTenderOwnerCommentStore
} from "@/src/board/service";
import type { ChecklistState } from "@/src/board/checklist";
import { getPrismaClient } from "@/src/lib/prisma";
import {
  rescoreTenderForUser,
  scoringActionFailure,
  setTenderDecisionForUser,
  type ActionResult as ScoringActionResult,
  type BidNoBidScore,
  type RescoreTenderStore,
  type SetTenderDecisionData,
  type SetTenderDecisionStore,
  type TenderDecisionOwnerRecord,
  type TenderDecisionValue,
  type TenderScoreMutationData,
  type TenderScoringOwnerRecord
} from "@/src/lib/scoring/bidNoBid";

const BOARD_PATH = "/board";
const TENDERS_PATH = "/tenders";

function toPrismaJson(value: ChecklistState): Prisma.InputJsonObject {
  return value as unknown as Prisma.InputJsonObject;
}

function toPrismaInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function createPrismaTenderChecklistStore(prisma: PrismaClient): UpdateTenderChecklistStore {
  return {
    async findOwnedTender(
      tenderId: string,
      userId: string
    ): Promise<TenderChecklistOwnerRecord | null> {
      return prisma.tender.findFirst({
        where: {
          id: tenderId,
          ownerId: userId
        },
        select: {
          id: true,
          ownerId: true
        }
      });
    },
    async updateTenderChecklist(
      tenderId: string,
      checklistState: ChecklistState
    ): Promise<{
      id: string;
      checklistState: ChecklistState;
    }> {
      const updated = await prisma.tender.update({
        where: {
          id: tenderId
        },
        data: {
          checklistState: toPrismaJson(checklistState)
        },
        select: {
          id: true
        }
      });

      return {
        id: updated.id,
        checklistState
      };
    }
  };
}

function createPrismaTenderOwnerCommentStore(prisma: PrismaClient): UpdateTenderOwnerCommentStore {
  return {
    async findOwnedTender(
      tenderId: string,
      userId: string
    ): Promise<TenderOwnerCommentOwnerRecord | null> {
      return prisma.tender.findFirst({
        where: {
          id: tenderId,
          ownerId: userId
        },
        select: {
          id: true,
          ownerId: true
        }
      });
    },
    async updateTenderOwnerComment(
      tenderId: string,
      ownerComment: string | null
    ): Promise<{
      id: string;
      ownerComment: string | null;
    }> {
      return prisma.tender.update({
        where: {
          id: tenderId
        },
        data: {
          ownerComment
        },
        select: {
          id: true,
          ownerComment: true
        }
      });
    }
  };
}

function createPrismaTenderScoringStore(prisma: PrismaClient): RescoreTenderStore {
  return {
    async findOwnedTenderForScoring(
      tenderId: string,
      userId: string
    ): Promise<TenderScoringOwnerRecord | null> {
      return prisma.tender.findFirst({
        where: {
          id: tenderId,
          ownerId: userId
        },
        select: {
          id: true,
          ownerId: true,
          title: true,
          description: true,
          customerName: true,
          purchaseMethod: true,
          initialPrice: true,
          currency: true,
          region: true,
          publishedAt: true,
          applicationStartAt: true,
          submissionDeadline: true,
          bidSecurityAmount: true,
          contractSecurityAmount: true,
          paymentTerms: true,
          participationRequirements: true,
          requiredDocuments: true,
          evaluationCriteria: true,
          sourceStage: true,
          owner: {
            select: {
              companyProfile: true,
              scoringPolicy: true
            }
          },
          documents: {
            select: {
              type: true,
              title: true,
              fileName: true,
              status: true,
              sourceUrl: true,
              storageKey: true
            }
          },
          aiAnalyses: {
            orderBy: {
              updatedAt: "desc"
            },
            take: 1,
            select: {
              status: true,
              score: true,
              summary: true,
              result: true
            }
          }
        }
      });
    },
    async saveTenderScore(tenderId: string, score: BidNoBidScore): Promise<{ id: string }> {
      return prisma.tender.update({
        where: {
          id: tenderId
        },
        data: {
          scoreTotal: score.scoreTotal,
          scoreFit: score.scoreFit,
          scoreEconomics: score.scoreEconomics,
          scoreExecutionRisk: score.scoreExecutionRisk,
          scoreComplianceRisk: score.scoreComplianceRisk,
          scoreUrgency: score.scoreUrgency,
          scoreConfidence: score.scoreConfidence,
          scoreBreakdown: toPrismaInputJson(score.scoreBreakdown),
          decision: TenderDecision[score.decision],
          decisionReason: score.decisionReason,
          lastScoredAt: score.lastScoredAt
        },
        select: {
          id: true
        }
      });
    }
  };
}

function createPrismaTenderDecisionStore(prisma: PrismaClient): SetTenderDecisionStore {
  return {
    async findOwnedTender(
      tenderId: string,
      userId: string
    ): Promise<TenderDecisionOwnerRecord | null> {
      return prisma.tender.findFirst({
        where: {
          id: tenderId,
          ownerId: userId
        },
        select: {
          id: true,
          ownerId: true
        }
      });
    },
    async updateTenderDecision(
      tenderId: string,
      decision: TenderDecisionValue,
      reason: string
    ): Promise<{
      id: string;
      decision: TenderDecisionValue;
      decisionReason: string | null;
    }> {
      return prisma.tender.update({
        where: {
          id: tenderId
        },
        data: {
          decision: TenderDecision[decision],
          decisionReason: reason
        },
        select: {
          id: true,
          decision: true,
          decisionReason: true
        }
      });
    }
  };
}

export async function updateTenderChecklist(
  tenderId: string,
  checklistState: ChecklistState
): Promise<ActionResult<UpdateTenderChecklistData>> {
  try {
    const user = await auth();

    if (!user?.id) {
      return boardActionFailure("UNAUTHORIZED", "Нужно войти в систему.");
    }

    const result = await updateTenderChecklistForUser(
      createPrismaTenderChecklistStore(getPrismaClient()),
      user.id,
      {
        tenderId,
        checklistState
      }
    );

    if (result.ok) {
      revalidatePath(BOARD_PATH);
      revalidatePath(`/tenders/${result.data.tenderId}`);
    }

    return result;
  } catch {
    return boardActionFailure("UNKNOWN_ERROR", "Не удалось сохранить checklist.");
  }
}

export async function updateTenderOwnerComment(
  tenderId: string,
  ownerComment: string
): Promise<ActionResult<UpdateTenderOwnerCommentData>> {
  try {
    const user = await auth();

    if (!user?.id) {
      return boardActionFailure("UNAUTHORIZED", "Нужно войти в систему.");
    }

    const result = await updateTenderOwnerCommentForUser(
      createPrismaTenderOwnerCommentStore(getPrismaClient()),
      user.id,
      {
        tenderId,
        ownerComment
      }
    );

    if (result.ok) {
      revalidatePath(BOARD_PATH);
      revalidatePath(`/tenders/${result.data.tenderId}`);
    }

    return result;
  } catch {
    return boardActionFailure("UNKNOWN_ERROR", "Не удалось сохранить комментарий.");
  }
}

export async function rescoreTender(
  tenderId: string
): Promise<ScoringActionResult<TenderScoreMutationData>> {
  try {
    const user = await auth();

    if (!user?.id) {
      return scoringActionFailure("UNAUTHORIZED", "Нужно войти в систему.");
    }

    const result = await rescoreTenderForUser(
      createPrismaTenderScoringStore(getPrismaClient()),
      user.id,
      {
        tenderId
      }
    );

    if (result.ok) {
      revalidatePath(BOARD_PATH);
      revalidatePath(TENDERS_PATH);
      revalidatePath(`/tenders/${result.data.tenderId}`);
    }

    return result;
  } catch {
    return scoringActionFailure("UNKNOWN_ERROR", "Не удалось пересчитать score.");
  }
}

export async function setTenderDecision(
  tenderId: string,
  decision: TenderDecisionValue,
  reason: string
): Promise<ScoringActionResult<SetTenderDecisionData>> {
  try {
    const user = await auth();

    if (!user?.id) {
      return scoringActionFailure("UNAUTHORIZED", "Нужно войти в систему.");
    }

    const result = await setTenderDecisionForUser(
      createPrismaTenderDecisionStore(getPrismaClient()),
      user.id,
      {
        tenderId,
        decision,
        reason
      }
    );

    if (result.ok) {
      revalidatePath(BOARD_PATH);
      revalidatePath(TENDERS_PATH);
      revalidatePath(`/tenders/${result.data.tenderId}`);
    }

    return result;
  } catch {
    return scoringActionFailure("UNKNOWN_ERROR", "Не удалось сохранить решение.");
  }
}
