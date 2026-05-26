import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, TenderSourceSystem } from "@prisma/client";
import {
  createEIS223Client,
  FastApiClientError,
  type EIS223Client,
  type EIS223SearchResponse,
  type EIS223SearchRequest
} from "@/src/eis223/client";
import { getPrismaClient } from "@/src/lib/prisma";
import {
  normalizedTenderDTOToPrismaInput,
  type NormalizedTenderDTO
} from "@/src/tenders/normalized-tender-dto";
import { deriveSourceStage } from "@/src/tenders/source-stage";
import { normalizeSavedFilterQuery } from "@/src/saved-filters/service";
import {
  computePayloadHash,
  createDocumentDedupeKey,
  createTenderSourceDedupeKey
} from "./source-identity";

const WATCHLIST_LOCK_NAME = "watchlists.run";
const DEFAULT_LOCK_TTL_SECONDS = 15 * 60;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_SEARCH_LIMIT = 20;

type SavedFilterForRun = {
  id: string;
  userId: string;
  name: string;
  query: unknown;
  lastCursor: string | null;
};

export type WatchlistRunSummary = {
  filtersProcessed: number;
  tendersCreated: number;
  tendersUpdated: number;
  documentsUpserted: number;
  errorsCount: number;
};

export type RunWatchlistsOptions = {
  prisma?: PrismaClient;
  client?: EIS223Client;
  batchSize?: number;
  filterId?: string;
  userId?: string;
  useLock?: boolean;
};

export class WatchlistRunAlreadyInProgressError extends Error {
  constructor() {
    super("Watchlist execution is already running.");
    this.name = "WatchlistRunAlreadyInProgressError";
  }
}

type WatchlistRunLockLease = {
  name: string;
  ownerToken: string;
};

type TenderSourceObservation = {
  providerMode: EIS223SearchResponse["providerMode"];
  seenAt: Date;
};

function emptySummary(): WatchlistRunSummary {
  return {
    filtersProcessed: 0,
    tendersCreated: 0,
    tendersUpdated: 0,
    documentsUpserted: 0,
    errorsCount: 0
  };
}

function getSearchLimit() {
  const rawLimit = process.env.WATCHLIST_SEARCH_LIMIT;
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_SEARCH_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return limit;
}

function getLockTtlSeconds() {
  const rawTtl = process.env.WATCHLIST_LOCK_TTL_SECONDS;
  const ttl = rawTtl ? Number(rawTtl) : DEFAULT_LOCK_TTL_SECONDS;

  if (!Number.isInteger(ttl) || ttl < 30) {
    return DEFAULT_LOCK_TTL_SECONDS;
  }

  return ttl;
}

function toSearchRequest(filter: SavedFilterForRun): EIS223SearchRequest {
  const query = normalizeSavedFilterQuery(filter.query);

  return {
    filterId: filter.id,
    searchQuery: query.searchQuery,
    includeKeywords: query.includeKeywords,
    excludeKeywords: query.excludeKeywords,
    okpd2Prefixes: query.okpd2Prefixes,
    regionCodes: query.regionCodes,
    methodAllowList: query.methodAllowList,
    customerInnAllowList: query.customerInnAllowList,
    customerInnBlockList: query.customerInnBlockList,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    daysAhead: query.daysAhead,
    cursor: filter.lastCursor,
    limit: getSearchLimit()
  };
}

function nullableDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function getInboxStageId(tx: Prisma.TransactionClient) {
  const inbox = await tx.kanbanStage.findFirst({
    where: { code: "INBOX" },
    select: { id: true }
  });

  if (inbox) {
    return inbox.id;
  }

  const fallback = await tx.kanbanStage.findFirst({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true }
  });

  if (!fallback) {
    throw new Error("At least one Kanban stage is required before importing tenders.");
  }

  return fallback.id;
}

function buildTenderWriteData(
  dto: NormalizedTenderDTO,
  payloadHash: string,
  observation: TenderSourceObservation
) {
  const mapped = normalizedTenderDTOToPrismaInput(dto);
  const updatedFromSourceAt = nullableDate(dto.deadlines.updatedFromSourceAt);
  const sourceStage = deriveSourceStage(dto, { now: observation.seenAt });
  const freshnessData = {
    lastSeenAt: observation.seenAt,
    updatedFromSourceAt,
    providerMode: observation.providerMode,
    sourceStage
  };

  return {
    mapped,
    freshnessData,
    data: {
      sourceSystem: TenderSourceSystem.EIS,
      externalId: mapped.tender.externalId,
      registryNumber: mapped.tender.registryNumber,
      lotNumber: mapped.tender.lotNumber,
      title: mapped.tender.title,
      description: mapped.tender.description,
      customerInn: mapped.tender.customerInn,
      customerName: mapped.tender.customerName,
      purchaseMethod: mapped.tender.purchaseMethod,
      initialPrice: mapped.tender.initialPrice,
      currency: mapped.tender.currency,
      region: mapped.tender.region,
      sourceUrl: mapped.tender.sourceUrl,
      publishedAt: mapped.tender.publishedAt,
      applicationStartAt: mapped.tender.applicationStartAt,
      submissionDeadline: mapped.tender.submissionDeadline,
      clarificationDeadlineAt: mapped.tender.clarificationDeadlineAt,
      resultAt: mapped.tender.resultAt,
      bidSecurityAmount: mapped.tender.bidSecurityAmount,
      contractSecurityAmount: mapped.tender.contractSecurityAmount,
      participationRequirements: toJson(mapped.tender.participationRequirements),
      requiredDocuments: toJson(mapped.tender.requiredDocuments),
      evaluationCriteria: toJson(mapped.tender.evaluationCriteria),
      changesFeed: toJson(mapped.tender.changesFeed),
      payloadHash,
      ...freshnessData
    }
  };
}

async function upsertTenderFromNormalizedDTO(
  tx: Prisma.TransactionClient,
  userId: string,
  dto: NormalizedTenderDTO,
  observation: TenderSourceObservation
) {
  const payloadHash = computePayloadHash(dto);
  const { mapped, data, freshnessData } = buildTenderWriteData(dto, payloadHash, observation);
  const sourceDedupeKey = createTenderSourceDedupeKey(
    userId,
    dto.externalPurchaseId,
    dto.lotNumber
  );
  const existingTender = await tx.tender.findUnique({
    where: { sourceDedupeKey },
    select: {
      id: true,
      payloadHash: true
    }
  });

  let tenderId: string;
  let created = false;
  let updated = false;

  if (existingTender) {
    tenderId = existingTender.id;

    if (existingTender.payloadHash !== payloadHash) {
      await tx.tender.update({
        where: { id: tenderId },
        data
      });
      updated = true;
    } else {
      await tx.tender.update({
        where: { id: tenderId },
        data: freshnessData
      });
    }
  } else {
    const kanbanStageId = await getInboxStageId(tx);
    const createdTender = await tx.tender.create({
      data: {
        ...data,
        sourceDedupeKey,
        ownerId: userId,
        kanbanStageId
      },
      select: {
        id: true
      }
    });

    tenderId = createdTender.id;
    created = true;
  }

  let documentsUpserted = 0;

  for (const [index, document] of mapped.documents.entries()) {
    const normalizedDocument = dto.documents[index];

    if (!normalizedDocument) {
      continue;
    }

    const dedupeKey = createDocumentDedupeKey({
      externalDocumentId: normalizedDocument.externalDocumentId,
      sourceHash: normalizedDocument.sourceHash,
      sourceUrl: normalizedDocument.sourceUrl,
      title: normalizedDocument.title
    });

    await tx.document.upsert({
      where: {
        tenderId_dedupeKey: {
          tenderId,
          dedupeKey
        }
      },
      update: {
        externalDocumentId: normalizedDocument.externalDocumentId,
        type: document.type,
        title: document.title,
        fileName: document.fileName,
        status: document.status,
        sourceUrl: document.sourceUrl,
        sourceHash: normalizedDocument.sourceHash,
        checksum: document.checksum,
        uploadedById: userId
      },
      create: {
        tenderId,
        externalDocumentId: normalizedDocument.externalDocumentId,
        dedupeKey,
        type: document.type,
        title: document.title,
        fileName: document.fileName,
        status: document.status,
        sourceUrl: document.sourceUrl,
        sourceHash: normalizedDocument.sourceHash,
        checksum: document.checksum,
        uploadedById: userId
      }
    });
    documentsUpserted += 1;
  }

  return {
    created,
    updated,
    documentsUpserted
  };
}

async function findFiltersForRun(
  prisma: PrismaClient,
  options: Pick<RunWatchlistsOptions, "batchSize" | "filterId" | "userId">
): Promise<SavedFilterForRun[]> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  return prisma.savedFilter.findMany({
    where: {
      isActive: true,
      id: options.filterId,
      userId: options.userId
    },
    orderBy: [{ lastRunAt: "asc" }, { createdAt: "asc" }],
    take: options.filterId ? 1 : batchSize,
    select: {
      id: true,
      userId: true,
      name: true,
      query: true,
      lastCursor: true
    }
  });
}

async function tryAcquireRunLock(prisma: PrismaClient): Promise<WatchlistRunLockLease | null> {
  const ownerToken = randomUUID();
  const ttlSeconds = getLockTtlSeconds();
  const [row] = await prisma.$queryRaw<Array<WatchlistRunLockLease>>`
    INSERT INTO "RuntimeLock" ("name", "ownerToken", "expiresAt", "createdAt", "updatedAt")
    VALUES (
      ${WATCHLIST_LOCK_NAME},
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

async function releaseRunLock(prisma: PrismaClient, lease: WatchlistRunLockLease) {
  await prisma.runtimeLock.deleteMany({
    where: {
      name: lease.name,
      ownerToken: lease.ownerToken
    }
  });
}

async function refreshRunLock(prisma: PrismaClient, lease: WatchlistRunLockLease) {
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
    throw new WatchlistRunAlreadyInProgressError();
  }
}

function safeErrorMessage(error: unknown) {
  if (error instanceof FastApiClientError) {
    return `${error.code}${error.status ? `:${error.status}` : ""}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown watchlist execution error.";
}

async function runWithoutLock(
  prisma: PrismaClient,
  client: EIS223Client,
  options: RunWatchlistsOptions,
  lease?: WatchlistRunLockLease
) {
  const summary = emptySummary();
  const filters = await findFiltersForRun(prisma, options);

  for (const filter of filters) {
    summary.filtersProcessed += 1;

    try {
      if (lease) {
        await refreshRunLock(prisma, lease);
      }

      const searchResponse = await client.search(toSearchRequest(filter));
      const seenAt = new Date();

      for (const hit of searchResponse.hits) {
        try {
          if (lease) {
            await refreshRunLock(prisma, lease);
          }

          const normalized = await client.normalizePurchase(hit.externalId, {
            includeRawPayload: true
          });
          const result = await prisma.$transaction((tx) =>
            upsertTenderFromNormalizedDTO(tx, filter.userId, normalized, {
              providerMode: searchResponse.providerMode,
              seenAt
            })
          );

          if (result.created) {
            summary.tendersCreated += 1;
          }

          if (result.updated) {
            summary.tendersUpdated += 1;
          }

          summary.documentsUpserted += result.documentsUpserted;
        } catch (error) {
          if (error instanceof WatchlistRunAlreadyInProgressError) {
            throw error;
          }

          summary.errorsCount += 1;
          console.warn("watchlists.run.hit_failed", {
            filterId: filter.id,
            externalPurchaseId: hit.externalId,
            error: safeErrorMessage(error)
          });
        }
      }

      if (lease) {
        await refreshRunLock(prisma, lease);
      }

      await prisma.savedFilter.update({
        where: { id: filter.id },
        data: {
          lastRunAt: new Date(),
          lastCursor: searchResponse.nextCursor,
          lastResultCount: searchResponse.hits.length
        }
      });
    } catch (error) {
      if (error instanceof WatchlistRunAlreadyInProgressError) {
        throw error;
      }

      summary.errorsCount += 1;
      console.warn("watchlists.run.filter_failed", {
        filterId: filter.id,
        error: safeErrorMessage(error)
      });
    }
  }

  console.info("watchlists.run.completed", summary);
  return summary;
}

export async function runWatchlists(
  options: RunWatchlistsOptions = {}
): Promise<WatchlistRunSummary> {
  const prisma = options.prisma ?? getPrismaClient();
  const client = options.client ?? createEIS223Client();

  if (!options.useLock) {
    return runWithoutLock(prisma, client, options);
  }

  const lease = await tryAcquireRunLock(prisma);

  if (!lease) {
    throw new WatchlistRunAlreadyInProgressError();
  }

  try {
    return await runWithoutLock(prisma, client, options, lease);
  } finally {
    await releaseRunLock(prisma, lease);
  }
}
