import { z } from "zod";

const isoDateTimeStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected an ISO-compatible datetime string"
});

const nullableDateTimeStringSchema = isoDateTimeStringSchema.nullable();
const nullableStringSchema = z.string().nullable();

const moneyStringSchema = z
  .union([z.string().trim().min(1), z.number().finite()])
  .transform((value) => String(value));

const nullableMoneyStringSchema = moneyStringSchema.nullable();

export const normalizedTenderDocumentTypeSchema = z.enum([
  "NOTICE",
  "DOCUMENTATION",
  "CHANGE",
  "CLARIFICATION",
  "PROTOCOL",
  "RESULT",
  "CONTRACT_DRAFT",
  "OTHER"
]);

export const normalizedTenderDTOSchema = z
  .object({
    externalPurchaseId: z.string().min(1),
    registryNumber: nullableStringSchema,
    purchaseNumber: nullableStringSchema,
    lotNumber: nullableStringSchema,
    sourceHash: nullableStringSchema,
    sourceUrl: nullableStringSchema,
    platformName: nullableStringSchema,
    title: z.string().min(1),
    subjectDescription: nullableStringSchema,
    methodName: nullableStringSchema,
    statusName: nullableStringSchema,
    customer: z
      .object({
        name: nullableStringSchema,
        inn: nullableStringSchema,
        kpp: nullableStringSchema,
        address: nullableStringSchema
      })
      .strict(),
    price: z
      .object({
        maxPrice: nullableMoneyStringSchema,
        priceFormula: nullableStringSchema,
        currencyCode: nullableStringSchema
      })
      .strict(),
    security: z
      .object({
        applicationSecurityAmount: nullableMoneyStringSchema,
        contractSecurityAmount: nullableMoneyStringSchema
      })
      .strict(),
    deadlines: z
      .object({
        applicationStartAt: nullableDateTimeStringSchema,
        applicationDeadlineAt: nullableDateTimeStringSchema,
        clarificationDeadlineAt: nullableDateTimeStringSchema,
        resultAt: nullableDateTimeStringSchema,
        publishedAt: nullableDateTimeStringSchema,
        updatedFromSourceAt: nullableDateTimeStringSchema
      })
      .strict(),
    delivery: z
      .object({
        deliveryPlace: nullableStringSchema,
        deliveryPeriodText: nullableStringSchema
      })
      .strict(),
    region: z
      .object({
        regionCode: nullableStringSchema,
        regionName: nullableStringSchema
      })
      .strict(),
    okpd2Codes: z.array(z.string()),
    documents: z.array(
      z
        .object({
          externalDocumentId: nullableStringSchema,
          type: normalizedTenderDocumentTypeSchema,
          title: z.string().min(1),
          fileName: nullableStringSchema,
          sourceUrl: nullableStringSchema,
          sourceHash: nullableStringSchema,
          publishedAt: nullableDateTimeStringSchema
        })
        .strict()
    ),
    requirements: z.array(z.string()),
    criteria: z.array(z.string()),
    changesFeed: z.array(
      z
        .object({
          at: nullableDateTimeStringSchema,
          title: z.string().min(1),
          description: nullableStringSchema,
          sourceHash: nullableStringSchema
        })
        .strict()
    ),
    sourcePayload: z.unknown().nullable()
  })
  .strict();

export type NormalizedTenderDocumentType = z.output<typeof normalizedTenderDocumentTypeSchema>;
export type NormalizedTenderDTO = z.output<typeof normalizedTenderDTOSchema>;

export type PrismaDocumentType =
  | "NOTICE"
  | "PROCUREMENT_DOCUMENTATION"
  | "TECHNICAL_SPECIFICATION"
  | "DRAFT_CONTRACT"
  | "CLARIFICATION"
  | "PROTOCOL"
  | "OTHER";

export type PrismaDocumentStatus = "AVAILABLE" | "EXTERNAL_ONLY" | "MISSING";

export type PrismaShapedTenderInput = {
  sourceSystem: "EIS";
  externalId: string;
  registryNumber: string | null;
  lotNumber: string | null;
  title: string;
  description: string | null;
  customerInn: string | null;
  customerName: string | null;
  purchaseMethod: string | null;
  initialPrice: string | null;
  currency: string;
  region: string | null;
  sourceUrl: string | null;
  publishedAt: Date | null;
  applicationStartAt: Date | null;
  submissionDeadline: Date | null;
  clarificationDeadlineAt: Date | null;
  resultAt: Date | null;
  bidSecurityAmount: string | null;
  contractSecurityAmount: string | null;
  participationRequirements: string[];
  requiredDocuments: Array<{
    externalDocumentId: string | null;
    type: NormalizedTenderDocumentType;
    title: string;
    fileName: string | null;
    sourceUrl: string | null;
    sourceHash: string | null;
  }>;
  evaluationCriteria: string[];
  changesFeed: NormalizedTenderDTO["changesFeed"];
};

export type PrismaShapedDocumentInput = {
  type: PrismaDocumentType;
  title: string;
  fileName: string | null;
  status: PrismaDocumentStatus;
  sourceUrl: string | null;
  checksum: string | null;
};

export type PrismaShapedNormalizedTenderInput = {
  tender: PrismaShapedTenderInput;
  documents: PrismaShapedDocumentInput[];
};

export function parseNormalizedTenderDTO(input: unknown): NormalizedTenderDTO {
  return normalizedTenderDTOSchema.parse(input);
}

export function normalizedTenderDTOToPrismaInput(
  input: NormalizedTenderDTO
): PrismaShapedNormalizedTenderInput {
  const dto = normalizedTenderDTOSchema.parse(input);

  return {
    tender: {
      sourceSystem: "EIS",
      externalId: dto.externalPurchaseId,
      registryNumber: dto.registryNumber,
      lotNumber: dto.lotNumber,
      title: dto.title,
      description: dto.subjectDescription,
      customerInn: dto.customer.inn,
      customerName: dto.customer.name,
      purchaseMethod: dto.methodName,
      initialPrice: dto.price.maxPrice,
      currency: dto.price.currencyCode ?? "RUB",
      region: dto.region.regionName ?? dto.region.regionCode,
      sourceUrl: dto.sourceUrl,
      publishedAt: nullableDate(dto.deadlines.publishedAt),
      applicationStartAt: nullableDate(dto.deadlines.applicationStartAt),
      submissionDeadline: nullableDate(dto.deadlines.applicationDeadlineAt),
      clarificationDeadlineAt: nullableDate(dto.deadlines.clarificationDeadlineAt),
      resultAt: nullableDate(dto.deadlines.resultAt),
      bidSecurityAmount: dto.security.applicationSecurityAmount,
      contractSecurityAmount: dto.security.contractSecurityAmount,
      participationRequirements: [...dto.requirements],
      requiredDocuments: dto.documents.map((document) => ({
        externalDocumentId: document.externalDocumentId,
        type: document.type,
        title: document.title,
        fileName: document.fileName,
        sourceUrl: document.sourceUrl,
        sourceHash: document.sourceHash
      })),
      evaluationCriteria: [...dto.criteria],
      changesFeed: dto.changesFeed.map((change) => ({ ...change }))
    },
    documents: dto.documents.map((document) => ({
      type: toPrismaDocumentType(document.type),
      title: document.title,
      fileName: document.fileName,
      status: document.sourceUrl ? "EXTERNAL_ONLY" : "MISSING",
      sourceUrl: document.sourceUrl,
      checksum: document.sourceHash
    }))
  };
}

export function unknownNormalizedTenderDTOToPrismaInput(
  input: unknown
): PrismaShapedNormalizedTenderInput {
  return normalizedTenderDTOToPrismaInput(parseNormalizedTenderDTO(input));
}

export function toPrismaDocumentType(type: NormalizedTenderDocumentType): PrismaDocumentType {
  switch (type) {
    case "NOTICE":
      return "NOTICE";
    case "DOCUMENTATION":
      return "PROCUREMENT_DOCUMENTATION";
    case "CONTRACT_DRAFT":
      return "DRAFT_CONTRACT";
    case "CLARIFICATION":
      return "CLARIFICATION";
    case "PROTOCOL":
      return "PROTOCOL";
    case "CHANGE":
    case "RESULT":
    case "OTHER":
      return "OTHER";
  }
}

function nullableDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
