import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createEIS223Client,
  FastApiClientError,
  type AIAnalysisClient,
  type AIAnalysisDocumentRequest,
  type AIAnalysisResponse
} from "@/src/eis223/client";
import { getPrismaClient } from "@/src/lib/prisma";

const ANALYSIS_LOCK_NAME = "analysis.run";
const DEFAULT_LOCK_TTL_SECONDS = 15 * 60;
const DEFAULT_BATCH_SIZE = 10;

type AIAnalysisKind = "TENDER_SUMMARY" | "DOCUMENT_SUMMARY";
type AIAnalysisStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AnalysisDocumentForRun = {
  id: string;
  title: string;
  type: string;
  status: string;
  extractionStatus: string;
  textContent: string | null;
  textChecksum: string | null;
};

export type AnalysisForRun = {
  id: string;
  tenderId: string;
  documentId: string | null;
  kind: AIAnalysisKind;
  targetKey: string;
  inputHash: string;
  promptVersion: string;
  status: AIAnalysisStatus;
  tender: {
    id: string;
    registryNumber: string | null;
    title: string;
    customerName: string | null;
    payloadHash: string | null;
    documents: AnalysisDocumentForRun[];
  };
  document: AnalysisDocumentForRun | null;
};

type AnalysisRunLockLease = {
  name: string;
  ownerToken: string;
};

export type AnalysisRunPrisma = {
  aiAnalysis: {
    findMany(args: unknown): Promise<AnalysisForRun[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
    update(args: unknown): Promise<unknown>;
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

export type AnalysisRunSummary = {
  analysesScanned: number;
  markedRunning: number;
  completed: number;
  failed: number;
  skipped: number;
  errorsCount: number;
};

export type AnalysisProcessor = {
  analyze(analysis: AnalysisForRun): Promise<unknown>;
};

export type RunAnalysisOptions = {
  prisma?: AnalysisRunPrisma;
  processor?: AnalysisProcessor;
  batchSize?: number;
  useLock?: boolean;
};

const analysisProcessorResponseSchema = z
  .object({
    provider: z.string().trim().min(1).max(80).default("local-mock"),
    model: z.string().trim().min(1).max(120).default("mock-analysis-v1"),
    summary: z.string().trim().min(1).max(4000).nullable(),
    score: z.number().int().min(0).max(100).nullable().optional(),
    result: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

type AnalysisProcessorResponse = z.output<typeof analysisProcessorResponseSchema>;

export class AnalysisRunAlreadyInProgressError extends Error {
  constructor() {
    super("AI analysis execution is already running.");
    this.name = "AnalysisRunAlreadyInProgressError";
  }
}

class AnalysisProcessorInvalidJsonError extends Error {
  constructor() {
    super("AI processor returned invalid JSON.");
    this.name = "AnalysisProcessorInvalidJsonError";
  }
}

class AnalysisProcessorInvalidSchemaError extends Error {
  constructor() {
    super("AI processor response failed validation.");
    this.name = "AnalysisProcessorInvalidSchemaError";
  }
}

export function emptyAnalysisRunSummary(
  overrides: Partial<AnalysisRunSummary> = {}
): AnalysisRunSummary {
  return {
    analysesScanned: 0,
    markedRunning: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    errorsCount: 0,
    ...overrides
  };
}

function getBatchSize(options: RunAnalysisOptions) {
  if (
    options.batchSize != null &&
    Number.isInteger(options.batchSize) &&
    options.batchSize > 0 &&
    options.batchSize <= 50
  ) {
    return options.batchSize;
  }

  const rawBatchSize = process.env.ANALYSIS_BATCH_SIZE;
  const batchSize = rawBatchSize ? Number(rawBatchSize) : DEFAULT_BATCH_SIZE;

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    return DEFAULT_BATCH_SIZE;
  }

  return batchSize;
}

function getLockTtlSeconds() {
  const rawTtl = process.env.ANALYSIS_LOCK_TTL_SECONDS;
  const ttl = rawTtl ? Number(rawTtl) : DEFAULT_LOCK_TTL_SECONDS;

  if (!Number.isInteger(ttl) || ttl < 30) {
    return DEFAULT_LOCK_TTL_SECONDS;
  }

  return ttl;
}

function parseProcessorResponse(raw: unknown): AnalysisProcessorResponse {
  let payload = raw;

  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new AnalysisProcessorInvalidJsonError();
    }
  }

  const parsed = analysisProcessorResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AnalysisProcessorInvalidSchemaError();
  }

  return parsed.data;
}

function safeErrorMessage(error: unknown) {
  if (
    error instanceof AnalysisProcessorInvalidJsonError ||
    error instanceof AnalysisProcessorInvalidSchemaError
  ) {
    return error.message;
  }

  if (error instanceof FastApiClientError) {
    return error.providerError ? `${error.providerError}: ${error.message}` : error.message;
  }

  return "AI analysis processor failed.";
}

function readyDocumentSummaries(analysis: AnalysisForRun) {
  return analysis.tender.documents
    .filter((document) => document.extractionStatus === "TEXT_READY" && document.textChecksum)
    .map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      textChecksum: document.textChecksum
    }));
}

function createLocalMockAnalysisProcessor(): AnalysisProcessor {
  return {
    async analyze(analysis) {
      const readyDocuments = readyDocumentSummaries(analysis);
      const tenderNumber = analysis.tender.registryNumber ?? analysis.tender.id;
      const title = analysis.tender.title.trim();
      const summary =
        analysis.kind === "DOCUMENT_SUMMARY" && analysis.document
          ? `Mock summary for document "${analysis.document.title}" in tender ${tenderNumber}.`
          : `Mock summary for tender ${tenderNumber}: ${title}. Ready documents: ${readyDocuments.length}.`;

      return {
        provider: "local-mock",
        model: "mock-analysis-v1",
        summary,
        score: null,
        result: {
          version: "analysis-mock-v1",
          kind: analysis.kind,
          inputHash: analysis.inputHash,
          promptVersion: analysis.promptVersion,
          tender: {
            id: analysis.tender.id,
            registryNumber: analysis.tender.registryNumber,
            payloadHash: analysis.tender.payloadHash
          },
          documents: readyDocuments
        }
      };
    }
  };
}

function shouldUseFastApiAnalysisProcessor() {
  const configuredProcessor = process.env.AI_ANALYSIS_PROCESSOR?.trim().toLowerCase();

  if (configuredProcessor === "local" || configuredProcessor === "mock") {
    return false;
  }

  if (configuredProcessor === "fastapi" || configuredProcessor === "api") {
    return true;
  }

  return Boolean(process.env.FASTAPI_BASE_URL?.trim());
}

function getRequestedProviderMode(): "mock" | "live" | undefined {
  const rawMode = (
    process.env.AI_ANALYSIS_PROVIDER_MODE ??
    process.env.AI_PROVIDER_MODE ??
    ""
  )
    .trim()
    .toLowerCase();

  if (rawMode === "mock" || rawMode === "live") {
    return rawMode;
  }

  return undefined;
}

function getRequestedProviderModel() {
  return process.env.AI_ANALYSIS_MODEL?.trim() || process.env.AI_PROVIDER_MODEL?.trim() || null;
}

function toAIAnalysisDocument(
  document: AnalysisDocumentForRun
): AIAnalysisDocumentRequest | null {
  const text = document.textContent?.trim();

  if (!text || document.extractionStatus !== "TEXT_READY") {
    return null;
  }

  return {
    documentId: document.id,
    title: document.title,
    text,
    textChecksum: document.textChecksum
  };
}

function deriveTrustedSummaryMarkdown(response: AIAnalysisResponse) {
  const summary =
    response.summaryItems.length === 0
      ? null
      : response.summaryItems.map((item) => `- ${item.text}`).join("\n");

  if (response.summaryMd !== summary) {
    throw new AnalysisProcessorInvalidSchemaError();
  }

  return summary;
}

function mapFastApiResponse(response: AIAnalysisResponse): AnalysisProcessorResponse {
  return {
    provider: response.provider === "mock" ? "fastapi-mock" : "fastapi-live",
    model: response.model,
    summary: deriveTrustedSummaryMarkdown(response),
    score: response.confidence,
    result: response
  };
}

export function createFastApiAnalysisProcessor(
  client: AIAnalysisClient = createEIS223Client()
): AnalysisProcessor {
  return {
    async analyze(analysis) {
      const providerMode = getRequestedProviderMode();
      const model = getRequestedProviderModel();
      const baseRequest = {
        tenderId: analysis.tender.id,
        registryNumber: analysis.tender.registryNumber,
        tenderTitle: analysis.tender.title,
        customerName: analysis.tender.customerName,
        promptVersion: analysis.promptVersion,
        language: "ru" as const,
        mode: providerMode,
        model
      };

      if (analysis.kind === "DOCUMENT_SUMMARY") {
        if (!analysis.document) {
          throw new Error("Document summary analysis is missing document identity.");
        }

        const document = toAIAnalysisDocument(analysis.document);
        if (!document) {
          throw new Error("Document summary analysis has no TEXT_READY document text.");
        }

        return mapFastApiResponse(
          await client.summarizeDocument({
            ...baseRequest,
            documentId: analysis.document.id,
            documents: [document]
          })
        );
      }

      const documents = analysis.tender.documents
        .map((document) => toAIAnalysisDocument(document))
        .filter((document): document is AIAnalysisDocumentRequest => document !== null);

      if (documents.length === 0) {
        throw new Error("Tender summary analysis has no TEXT_READY document texts.");
      }

      return mapFastApiResponse(
        await client.summarizeTender({
          ...baseRequest,
          documents
        })
      );
    }
  };
}

function createDefaultAnalysisProcessor() {
  if (shouldUseFastApiAnalysisProcessor()) {
    return createFastApiAnalysisProcessor();
  }

  return createLocalMockAnalysisProcessor();
}

async function findPendingAnalyses(prisma: AnalysisRunPrisma, options: RunAnalysisOptions) {
  return prisma.aiAnalysis.findMany({
    where: {
      status: "PENDING"
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: getBatchSize(options),
    select: {
      id: true,
      tenderId: true,
      documentId: true,
      kind: true,
      targetKey: true,
      inputHash: true,
      promptVersion: true,
      status: true,
      tender: {
        select: {
          id: true,
          registryNumber: true,
          title: true,
          customerName: true,
          payloadHash: true,
          documents: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              extractionStatus: true,
              textContent: true,
              textChecksum: true
            }
          }
        }
      },
      document: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          extractionStatus: true,
          textContent: true,
          textChecksum: true
        }
      }
    }
  });
}

async function markAnalysisRunning(prisma: AnalysisRunPrisma, analysisId: string, now: Date) {
  return prisma.aiAnalysis.updateMany({
    where: {
      id: analysisId,
      status: "PENDING"
    },
    data: {
      status: "RUNNING",
      startedAt: now,
      completedAt: null,
      errorMessage: null,
      error: null
    }
  });
}

async function markAnalysisCompleted(input: {
  prisma: AnalysisRunPrisma;
  analysis: AnalysisForRun;
  response: AnalysisProcessorResponse;
  now: Date;
}) {
  await input.prisma.aiAnalysis.update({
    where: {
      id: input.analysis.id
    },
    data: {
      status: "COMPLETED",
      provider: input.response.provider,
      model: input.response.model,
      summary: input.response.summary,
      score: input.response.score ?? null,
      result: {
        version: "analysis-result-v1",
        processedAt: input.now.toISOString(),
        inputHash: input.analysis.inputHash,
        promptVersion: input.analysis.promptVersion,
        output: input.response.result
      },
      errorMessage: null,
      error: null,
      completedAt: input.now
    }
  });
}

async function markAnalysisFailed(input: {
  prisma: AnalysisRunPrisma;
  analysis: AnalysisForRun;
  errorMessage: string;
  now: Date;
}) {
  await input.prisma.aiAnalysis.update({
    where: {
      id: input.analysis.id
    },
    data: {
      status: "FAILED",
      provider: "local-mock",
      model: "mock-analysis-v1",
      summary: null,
      score: null,
      result: {
        version: "analysis-result-v1",
        failedAt: input.now.toISOString(),
        inputHash: input.analysis.inputHash,
        promptVersion: input.analysis.promptVersion
      },
      errorMessage: input.errorMessage,
      error: input.errorMessage,
      completedAt: input.now
    }
  });
}

async function tryAcquireRunLock(
  prisma: AnalysisRunPrisma
): Promise<AnalysisRunLockLease | null> {
  const ownerToken = randomUUID();
  const ttlSeconds = getLockTtlSeconds();
  const [row] = await prisma.$queryRaw<Array<AnalysisRunLockLease>>`
    INSERT INTO "RuntimeLock" ("name", "ownerToken", "expiresAt", "createdAt", "updatedAt")
    VALUES (
      ${ANALYSIS_LOCK_NAME},
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

async function releaseRunLock(prisma: AnalysisRunPrisma, lease: AnalysisRunLockLease) {
  await prisma.runtimeLock.deleteMany({
    where: {
      name: lease.name,
      ownerToken: lease.ownerToken
    }
  });
}

async function refreshRunLock(prisma: AnalysisRunPrisma, lease: AnalysisRunLockLease) {
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
    throw new AnalysisRunAlreadyInProgressError();
  }
}

async function runWithoutLock(
  prisma: AnalysisRunPrisma,
  processor: AnalysisProcessor,
  options: RunAnalysisOptions,
  lease?: AnalysisRunLockLease
) {
  const summary = emptyAnalysisRunSummary();
  const analyses = await findPendingAnalyses(prisma, options);
  summary.analysesScanned = analyses.length;

  for (const analysis of analyses) {
    if (lease) {
      await refreshRunLock(prisma, lease);
    }

    const now = new Date();
    const running = await markAnalysisRunning(prisma, analysis.id, now);

    if (running.count !== 1) {
      summary.skipped += 1;
      continue;
    }

    summary.markedRunning += 1;

    try {
      const response = parseProcessorResponse(await processor.analyze(analysis));
      await markAnalysisCompleted({
        prisma,
        analysis,
        response,
        now: new Date()
      });
      summary.completed += 1;
    } catch (error) {
      const errorMessage = safeErrorMessage(error);
      await markAnalysisFailed({
        prisma,
        analysis,
        errorMessage,
        now: new Date()
      });
      summary.failed += 1;
      summary.errorsCount += 1;

      console.warn("analysis.run.analysis_failed", {
        analysisId: analysis.id,
        error: errorMessage
      });
    }
  }

  console.info("analysis.run.completed", summary);
  return summary;
}

export async function runAnalysis(
  options: RunAnalysisOptions = {}
): Promise<AnalysisRunSummary> {
  const prisma = options.prisma ?? (getPrismaClient() as unknown as AnalysisRunPrisma);
  const processor = options.processor ?? createDefaultAnalysisProcessor();

  if (!options.useLock) {
    return runWithoutLock(prisma, processor, options);
  }

  const lease = await tryAcquireRunLock(prisma);

  if (!lease) {
    throw new AnalysisRunAlreadyInProgressError();
  }

  try {
    return await runWithoutLock(prisma, processor, options, lease);
  } finally {
    await releaseRunLock(prisma, lease);
  }
}
