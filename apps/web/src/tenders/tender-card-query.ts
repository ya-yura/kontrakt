import type { PrismaClient } from "@prisma/client";

export function findTenderCardForUser(prisma: PrismaClient, tenderId: string, userId: string) {
  return prisma.tender.findFirst({
    where: {
      id: tenderId,
      ownerId: userId
    },
    select: {
      id: true,
      registryNumber: true,
      lotNumber: true,
      title: true,
      description: true,
      customerInn: true,
      customerName: true,
      purchaseMethod: true,
      initialPrice: true,
      currency: true,
      region: true,
      sourceUrl: true,
      publishedAt: true,
      applicationStartAt: true,
      submissionDeadline: true,
      clarificationDeadlineAt: true,
      resultAt: true,
      bidSecurityAmount: true,
      contractSecurityAmount: true,
      paymentTerms: true,
      participationRequirements: true,
      requiredDocuments: true,
      evaluationCriteria: true,
      changesFeed: true,
      lastSeenAt: true,
      updatedFromSourceAt: true,
      providerMode: true,
      sourceStage: true,
      decision: true,
      decisionReason: true,
      scoreTotal: true,
      scoreFit: true,
      scoreEconomics: true,
      scoreExecutionRisk: true,
      scoreComplianceRisk: true,
      scoreUrgency: true,
      scoreConfidence: true,
      lastScoredAt: true,
      checklistState: true,
      ownerComment: true,
      kanbanStage: {
        select: {
          code: true,
          name: true,
          description: true,
          checklistTemplate: true
        }
      },
      documents: {
        orderBy: [{ createdAt: "asc" }, { title: "asc" }],
        select: {
          id: true,
          type: true,
          title: true,
          fileName: true,
          status: true,
          sourceUrl: true,
          storageKey: true
        }
      },
      alertDeliveries: {
        where: {
          userId
        },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          channel: true,
          type: true,
          sentAt: true,
          acknowledgedAt: true,
          errorMessage: true,
          createdAt: true
        }
      }
    }
  });
}
