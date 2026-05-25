import {
  DocumentStatus,
  DocumentType,
  PrismaClient,
  TenderDecision,
  TenderSourceStage,
  TenderSourceSystem,
  UserRole
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { EIS223Adapter } from "../src/tenders/adapters/eis-223-adapter";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set for Prisma seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl)
});

const DEFAULT_DEV_USER_EMAIL = "dev.supplier@example.local";
const DEFAULT_DEV_USER_NAME = "Dev Supplier";

const defaultStages = [
  {
    code: "INBOX",
    name: "Inbox",
    description: "New tenders waiting for qualification",
    position: 100,
    isTerminal: false
  },
  {
    code: "QUALIFY",
    name: "Qualify",
    description: "Initial fit and risk review",
    position: 200,
    isTerminal: false
  },
  {
    code: "GO",
    name: "Go",
    description: "Approved to pursue",
    position: 300,
    isTerminal: false
  },
  {
    code: "PREPARE",
    name: "Prepare",
    description: "Submission package preparation",
    position: 400,
    isTerminal: false
  },
  {
    code: "SUBMITTED_EXTERNALLY",
    name: "Submitted externally",
    description: "Submission completed outside the workspace",
    position: 500,
    isTerminal: false
  },
  {
    code: "WON",
    name: "Won",
    description: "Tender won",
    position: 600,
    isTerminal: true
  },
  {
    code: "LOST",
    name: "Lost",
    description: "Tender lost",
    position: 700,
    isTerminal: true
  },
  {
    code: "ARCHIVED",
    name: "Archived",
    description: "No active work",
    position: 800,
    isTerminal: true
  }
] as const;

async function main() {
  for (const stage of defaultStages) {
    await prisma.kanbanStage.upsert({
      where: { code: stage.code },
      update: {
        name: stage.name,
        description: stage.description,
        position: stage.position,
        isDefault: true,
        isTerminal: stage.isTerminal
      },
      create: {
        ...stage,
        isDefault: true
      }
    });
  }

  const email = process.env.DEV_AUTH_USER_EMAIL?.trim() || DEFAULT_DEV_USER_EMAIL;
  const name = process.env.DEV_AUTH_USER_NAME?.trim() || DEFAULT_DEV_USER_NAME;
  const currentUser = await prisma.user.upsert({
    where: { email },
    update: { name, role: UserRole.ADMIN },
    create: { email, name, role: UserRole.ADMIN }
  });

  const stageRecords = await prisma.kanbanStage.findMany({
    where: {
      code: {
        in: defaultStages.map((stage) => stage.code)
      }
    },
    select: {
      id: true,
      code: true
    }
  });
  const stageIdsByCode = new Map(stageRecords.map((stage) => [stage.code, stage.id]));
  const adapter = new EIS223Adapter();
  const tenders = await adapter.listNormalizedTenders();

  for (const tender of tenders) {
    const kanbanStageId = stageIdsByCode.get(tender.kanbanStageCode);

    if (!kanbanStageId) {
      throw new Error(`Missing Kanban stage for fixture: ${tender.kanbanStageCode}`);
    }

    const record = await prisma.tender.upsert({
      where: {
        sourceSystem_externalId: {
          sourceSystem: TenderSourceSystem.EIS,
          externalId: tender.externalId
        }
      },
      update: {
        registryNumber: tender.registryNumber,
        lotNumber: tender.lotNumber,
        title: tender.title,
        description: tender.description,
        customerInn: tender.customerInn,
        customerName: tender.customerName,
        purchaseMethod: tender.purchaseMethod,
        initialPrice: tender.maxPrice,
        currency: tender.currency,
        region: tender.region,
        sourceUrl: tender.sourceUrl,
        publishedAt: new Date(tender.publishedAt),
        applicationStartAt: tender.applicationStartAt ? new Date(tender.applicationStartAt) : null,
        submissionDeadline: new Date(tender.applicationDeadlineAt),
        clarificationDeadlineAt: tender.clarificationDeadlineAt
          ? new Date(tender.clarificationDeadlineAt)
          : null,
        resultAt: tender.resultAt ? new Date(tender.resultAt) : null,
        bidSecurityAmount: tender.bidSecurityAmount ?? null,
        contractSecurityAmount: tender.contractSecurityAmount ?? null,
        paymentTerms: tender.paymentTerms ?? null,
        participationRequirements: tender.participationRequirements,
        requiredDocuments: tender.requiredDocuments,
        evaluationCriteria: tender.evaluationCriteria,
        changesFeed: tender.changesFeed,
        sourceStage: TenderSourceStage[tender.sourceStage],
        decision: TenderDecision[tender.decision],
        kanbanStageId,
        ownerId: currentUser.id
      },
      create: {
        sourceSystem: TenderSourceSystem.EIS,
        externalId: tender.externalId,
        registryNumber: tender.registryNumber,
        lotNumber: tender.lotNumber,
        title: tender.title,
        description: tender.description,
        customerInn: tender.customerInn,
        customerName: tender.customerName,
        purchaseMethod: tender.purchaseMethod,
        initialPrice: tender.maxPrice,
        currency: tender.currency,
        region: tender.region,
        sourceUrl: tender.sourceUrl,
        publishedAt: new Date(tender.publishedAt),
        applicationStartAt: tender.applicationStartAt ? new Date(tender.applicationStartAt) : null,
        submissionDeadline: new Date(tender.applicationDeadlineAt),
        clarificationDeadlineAt: tender.clarificationDeadlineAt
          ? new Date(tender.clarificationDeadlineAt)
          : null,
        resultAt: tender.resultAt ? new Date(tender.resultAt) : null,
        bidSecurityAmount: tender.bidSecurityAmount ?? null,
        contractSecurityAmount: tender.contractSecurityAmount ?? null,
        paymentTerms: tender.paymentTerms ?? null,
        participationRequirements: tender.participationRequirements,
        requiredDocuments: tender.requiredDocuments,
        evaluationCriteria: tender.evaluationCriteria,
        changesFeed: tender.changesFeed,
        sourceStage: TenderSourceStage[tender.sourceStage],
        decision: TenderDecision[tender.decision],
        kanbanStageId,
        ownerId: currentUser.id
      }
    });

    await prisma.document.deleteMany({
      where: {
        tenderId: record.id
      }
    });

    if (tender.documents.length > 0) {
      await prisma.document.createMany({
        data: tender.documents.map((document) => ({
          tenderId: record.id,
          type: DocumentType[document.type],
          title: document.title,
          fileName: document.fileName ?? null,
          status: DocumentStatus[document.status],
          sourceUrl: document.sourceUrl,
          storageKey: `mock/eis-223/${tender.externalId}/${document.externalId}.pdf`,
          uploadedById: currentUser.id
        }))
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
