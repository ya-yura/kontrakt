import { randomUUID } from "node:crypto";
import {
  createEIS223Client,
  FastApiClientError,
  type DocumentTextExtractionClient,
  type DocumentTextExtractionRequest,
  type DocumentTextExtractionResponse
} from "@/src/eis223/client";
import { getPrismaClient } from "@/src/lib/prisma";

const DOCUMENT_EXTRACTION_LOCK_NAME = "documents.extract-text";
const DEFAULT_LOCK_TTL_SECONDS = 15 * 60;
const DEFAULT_BATCH_SIZE = 20;
const ELIGIBLE_EXTRACTION_STATUSES = ["PENDING", "DOWNLOADED", "OCR_REQUIRED"] as const;

type DocumentExtractionStatus =
  | (typeof ELIGIBLE_EXTRACTION_STATUSES)[number]
  | "TEXT_READY"
  | "FAILED";

type DocumentForExtraction = {
  id: string;
  externalDocumentId: string | null;
  title: string;
  fileName: string | null;
  status: string;
  sourceUrl: string | null;
  storageKey: string | null;
  extractionStatus: DocumentExtractionStatus;
};

type DocumentExtractionUpdateData = {
  extractionStatus: DocumentExtractionStatus;
  textContent: string | null;
  textChecksum: string | null;
  pageCount: number | null;
  hasTextLayer: boolean | null;
  extractionMetadata: Record<string, unknown>;
};

type DocumentExtractionPrisma = {
  document: {
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: Array<Record<string, string>>;
      take: number;
      select: Record<keyof DocumentForExtraction, true>;
    }): Promise<DocumentForExtraction[]>;
    update(args: {
      where: { id: string };
      data: DocumentExtractionUpdateData;
    }): Promise<unknown>;
  };
  runtimeLock: {
    deleteMany(args: { where: { name: string; ownerToken: string } }): Promise<unknown>;
    updateMany(args: {
      where: { name: string; ownerToken: string };
      data: { expiresAt: Date };
    }): Promise<{ count: number }>;
  };
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type DocumentExtractionLockLease = {
  name: string;
  ownerToken: string;
};

export type DocumentExtractionRunSummary = {
  documentsScanned: number;
  textReady: number;
  ocrRequired: number;
  failed: number;
  skipped: number;
  errorsCount: number;
};

export type RunDocumentTextExtractionOptions = {
  prisma?: DocumentExtractionPrisma;
  client?: DocumentTextExtractionClient;
  batchSize?: number;
  documentId?: string;
  maxPages?: number;
  useLock?: boolean;
};

export class DocumentExtractionRunAlreadyInProgressError extends Error {
  constructor() {
    super("Document text extraction is already running.");
    this.name = "DocumentExtractionRunAlreadyInProgressError";
  }
}

export function emptyDocumentExtractionRunSummary(
  overrides: Partial<DocumentExtractionRunSummary> = {}
): DocumentExtractionRunSummary {
  return {
    documentsScanned: 0,
    textReady: 0,
    ocrRequired: 0,
    failed: 0,
    skipped: 0,
    errorsCount: 0,
    ...overrides
  };
}

function getBatchSize(options: RunDocumentTextExtractionOptions) {
  if (
    options.batchSize != null &&
    Number.isInteger(options.batchSize) &&
    options.batchSize > 0 &&
    options.batchSize <= 100
  ) {
    return options.batchSize;
  }

  const rawBatchSize = process.env.DOCUMENT_EXTRACTION_BATCH_SIZE;
  const batchSize = rawBatchSize ? Number(rawBatchSize) : DEFAULT_BATCH_SIZE;

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    return DEFAULT_BATCH_SIZE;
  }

  return batchSize;
}

function getLockTtlSeconds() {
  const rawTtl = process.env.DOCUMENT_EXTRACTION_LOCK_TTL_SECONDS;
  const ttl = rawTtl ? Number(rawTtl) : DEFAULT_LOCK_TTL_SECONDS;

  if (!Number.isInteger(ttl) || ttl < 30) {
    return DEFAULT_LOCK_TTL_SECONDS;
  }

  return ttl;
}

function inferMimeType(document: DocumentForExtraction) {
  const locator = document.fileName ?? document.sourceUrl ?? document.storageKey ?? "";

  if (locator.toLocaleLowerCase("en-US").includes(".pdf")) {
    return "application/pdf";
  }

  return "application/octet-stream";
}

function buildExtractionRequest(
  document: DocumentForExtraction,
  options: RunDocumentTextExtractionOptions
): DocumentTextExtractionRequest | null {
  if (!document.sourceUrl && !document.storageKey) {
    return null;
  }

  return {
    documentId: document.id,
    externalDocumentId: document.externalDocumentId,
    fileUrl: document.storageKey ? null : document.sourceUrl,
    storageKey: document.storageKey,
    fileName: document.fileName ?? document.title,
    mimeType: inferMimeType(document),
    maxPages: options.maxPages
  };
}

function buildExtractionMetadata(input: {
  document: DocumentForExtraction;
  response?: DocumentTextExtractionResponse;
  errorMessage?: string;
  now: Date;
}) {
  return {
    version: "document-text-extraction-v1",
    extractedAt: input.now.toISOString(),
    previousExtractionStatus: input.document.extractionStatus,
    fastApi: input.response?.metadata ?? null,
    errorMessage: input.response?.errorMessage ?? input.errorMessage ?? null,
    ocr: {
      implemented: false
    }
  };
}

function toUpdateData(input: {
  document: DocumentForExtraction;
  response: DocumentTextExtractionResponse;
  now: Date;
}): DocumentExtractionUpdateData {
  const textContent = input.response.status === "TEXT_READY" ? input.response.text : null;

  return {
    extractionStatus: input.response.status,
    textContent,
    textChecksum: input.response.textChecksum,
    pageCount: input.response.pageCount,
    hasTextLayer: input.response.hasTextLayer,
    extractionMetadata: buildExtractionMetadata(input)
  };
}

function toFailureUpdateData(input: {
  document: DocumentForExtraction;
  errorMessage: string;
  now: Date;
}): DocumentExtractionUpdateData {
  return {
    extractionStatus: "FAILED",
    textContent: null,
    textChecksum: null,
    pageCount: null,
    hasTextLayer: null,
    extractionMetadata: buildExtractionMetadata(input)
  };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof FastApiClientError) {
    return `${error.code}${error.status ? `:${error.status}` : ""}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown document text extraction error.";
}

async function findDocumentsForExtraction(
  prisma: DocumentExtractionPrisma,
  options: RunDocumentTextExtractionOptions
) {
  return prisma.document.findMany({
    where: {
      id: options.documentId,
      status: {
        not: "MISSING"
      },
      extractionStatus: {
        in: [...ELIGIBLE_EXTRACTION_STATUSES]
      },
      OR: [
        {
          sourceUrl: {
            not: null
          }
        },
        {
          storageKey: {
            not: null
          }
        }
      ]
    },
    orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    take: options.documentId ? 1 : getBatchSize(options),
    select: {
      id: true,
      externalDocumentId: true,
      title: true,
      fileName: true,
      status: true,
      sourceUrl: true,
      storageKey: true,
      extractionStatus: true
    }
  });
}

async function tryAcquireRunLock(
  prisma: DocumentExtractionPrisma
): Promise<DocumentExtractionLockLease | null> {
  const ownerToken = randomUUID();
  const ttlSeconds = getLockTtlSeconds();
  const [row] = await prisma.$queryRaw<Array<DocumentExtractionLockLease>>`
    INSERT INTO "RuntimeLock" ("name", "ownerToken", "expiresAt", "createdAt", "updatedAt")
    VALUES (
      ${DOCUMENT_EXTRACTION_LOCK_NAME},
      ${ownerToken},
      NOW() + (${ttlSeconds} * INTERVAL '1 second'),
      NOW(),
      NOW()
    )
    ON CONFLICT ("name") DO UPDATE
    SET
      "ownerToken" = EXCLUDED."ownerToken",
      "expiresAt" = EXCLUDED."expiresAt",
      "updatedAt" = NOW()
    WHERE "RuntimeLock"."expiresAt" <= NOW()
    RETURNING "name", "ownerToken"
  `;

  return row ?? null;
}

async function releaseRunLock(
  prisma: DocumentExtractionPrisma,
  lease: DocumentExtractionLockLease
) {
  await prisma.runtimeLock.deleteMany({
    where: {
      name: lease.name,
      ownerToken: lease.ownerToken
    }
  });
}

async function refreshRunLock(
  prisma: DocumentExtractionPrisma,
  lease: DocumentExtractionLockLease
) {
  const refreshed = await prisma.runtimeLock.updateMany({
    where: {
      name: lease.name,
      ownerToken: lease.ownerToken
    },
    data: {
      expiresAt: new Date(Date.now() + getLockTtlSeconds() * 1000)
    }
  });

  if (refreshed.count !== 1) {
    throw new DocumentExtractionRunAlreadyInProgressError();
  }
}

async function runWithoutLock(
  prisma: DocumentExtractionPrisma,
  client: DocumentTextExtractionClient,
  options: RunDocumentTextExtractionOptions,
  lease?: DocumentExtractionLockLease
) {
  const summary = emptyDocumentExtractionRunSummary();
  const documents = await findDocumentsForExtraction(prisma, options);
  summary.documentsScanned = documents.length;

  for (const document of documents) {
    try {
      if (lease) {
        await refreshRunLock(prisma, lease);
      }

      const request = buildExtractionRequest(document, options);

      if (!request) {
        summary.skipped += 1;
        continue;
      }

      const response = await client.extractText(request);
      const now = new Date();
      await prisma.document.update({
        where: { id: document.id },
        data: toUpdateData({ document, response, now })
      });

      if (response.status === "TEXT_READY") {
        summary.textReady += 1;
      } else if (response.status === "OCR_REQUIRED") {
        summary.ocrRequired += 1;
      } else {
        summary.failed += 1;
      }
    } catch (error) {
      if (error instanceof DocumentExtractionRunAlreadyInProgressError) {
        throw error;
      }

      summary.failed += 1;
      summary.errorsCount += 1;
      const errorMessage = safeErrorMessage(error);

      await prisma.document.update({
        where: { id: document.id },
        data: toFailureUpdateData({
          document,
          errorMessage,
          now: new Date()
        })
      });

      console.warn("documents.extract_text.document_failed", {
        documentId: document.id,
        error: errorMessage
      });
    }
  }

  console.info("documents.extract_text.completed", summary);
  return summary;
}

export async function runDocumentTextExtraction(
  options: RunDocumentTextExtractionOptions = {}
): Promise<DocumentExtractionRunSummary> {
  const prisma = options.prisma ?? (getPrismaClient() as unknown as DocumentExtractionPrisma);
  const client = options.client ?? createEIS223Client();

  if (!options.useLock) {
    return runWithoutLock(prisma, client, options);
  }

  const lease = await tryAcquireRunLock(prisma);

  if (!lease) {
    throw new DocumentExtractionRunAlreadyInProgressError();
  }

  try {
    return await runWithoutLock(prisma, client, options, lease);
  } finally {
    await releaseRunLock(prisma, lease);
  }
}
