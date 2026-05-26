import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import type { EIS223Client } from "../src/eis223/client";
import { runWatchlists, type WatchlistRunSummary } from "../src/watchlists/run-watchlists";
import { validateCronAuthorization } from "../src/watchlists/cron-auth";
import {
  computePayloadHash,
  createDocumentDedupeKey,
  createTenderSourceDedupeKey
} from "../src/watchlists/source-identity";
import { deriveSourceStage } from "../src/tenders/source-stage";
import type { NormalizedTenderDTO } from "../src/tenders/normalized-tender-dto";

type StoredTender = {
  id: string;
  sourceDedupeKey: string;
  payloadHash: string | null;
  kanbanStageId: string;
  sourceStage: string;
  lastSeenAt: Date | null;
  updatedFromSourceAt: Date | null;
  providerMode: string;
  updateCount: number;
};

type StoredDocument = {
  tenderId: string;
  dedupeKey: string;
  title: string;
  updateCount: number;
};

type StoredSavedFilter = {
  id: string;
  userId: string;
  name: string;
  query: unknown;
  lastCursor: string | null;
  lastRunAt: Date | null;
  lastResultCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

class RepeatRunPrismaFake {
  readonly tendersBySourceKey = new Map<string, StoredTender>();
  readonly documentsByTenderDedupeKey = new Map<string, StoredDocument>();

  private readonly tendersById = new Map<string, StoredTender>();
  private nextTenderId = 1;
  private readonly savedFilters: StoredSavedFilter[] = [
    {
      id: "filter-1",
      userId: "user-1",
      name: "Dental consumables",
      query: {},
      lastCursor: null,
      lastRunAt: null,
      lastResultCount: 0,
      isActive: true,
      createdAt: new Date("2026-05-25T09:00:00+03:00"),
      updatedAt: new Date("2026-05-25T09:00:00+03:00")
    }
  ];

  readonly savedFilter = {
    findMany: async (args: {
      where: { id?: string; userId?: string; isActive?: boolean };
      take?: number;
    }) => {
      const filters = this.savedFilters.filter((filter) => {
        if (args.where.id && filter.id !== args.where.id) {
          return false;
        }

        if (args.where.userId && filter.userId !== args.where.userId) {
          return false;
        }

        if (args.where.isActive != null && filter.isActive !== args.where.isActive) {
          return false;
        }

        return true;
      });

      return filters.slice(0, args.take ?? filters.length);
    },
    update: async (args: {
      where: { id: string };
      data: { lastRunAt: Date; lastCursor: string | null; lastResultCount: number };
    }) => {
      const filter = this.savedFilters.find((item) => item.id === args.where.id);

      if (!filter) {
        throw new Error("Missing fake saved filter.");
      }

      filter.lastRunAt = args.data.lastRunAt;
      filter.lastCursor = args.data.lastCursor;
      filter.lastResultCount = args.data.lastResultCount;
      return filter;
    }
  };

  readonly kanbanStage = {
    findFirst: async () => ({
      id: "stage-inbox"
    })
  };

  readonly tender = {
    findUnique: async (args: { where: { sourceDedupeKey: string } }) => {
      const tender = this.tendersBySourceKey.get(args.where.sourceDedupeKey);

      if (!tender) {
        return null;
      }

      return {
        id: tender.id,
        payloadHash: tender.payloadHash
      };
    },
    update: async (args: { where: { id: string }; data: Partial<StoredTender> }) => {
      const tender = this.tendersById.get(args.where.id);

      if (!tender) {
        throw new Error("Missing fake tender.");
      }

      Object.assign(tender, args.data);
      tender.updateCount += 1;
      return tender;
    },
    create: async (args: { data: StoredTender; select: { id: true } }) => {
      const tender = {
        ...args.data,
        id: `tender-${this.nextTenderId}`,
        updateCount: 0
      };
      this.nextTenderId += 1;
      this.tendersBySourceKey.set(tender.sourceDedupeKey, tender);
      this.tendersById.set(tender.id, tender);

      return {
        id: tender.id
      };
    }
  };

  readonly document = {
    upsert: async (args: {
      where: { tenderId_dedupeKey: { tenderId: string; dedupeKey: string } };
      update: { title: string };
      create: { tenderId: string; dedupeKey: string; title: string };
    }) => {
      const documentKey = `${args.where.tenderId_dedupeKey.tenderId}:${args.where.tenderId_dedupeKey.dedupeKey}`;
      const existing = this.documentsByTenderDedupeKey.get(documentKey);

      if (existing) {
        existing.title = args.update.title;
        existing.updateCount += 1;
        return existing;
      }

      const created = {
        tenderId: args.create.tenderId,
        dedupeKey: args.create.dedupeKey,
        title: args.create.title,
        updateCount: 0
      };
      this.documentsByTenderDedupeKey.set(documentKey, created);
      return created;
    }
  };

  async $transaction<T>(callback: (tx: RepeatRunPrismaFake) => Promise<T>): Promise<T> {
    return callback(this);
  }

  asPrismaClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  onlyTender() {
    assert.equal(this.tendersBySourceKey.size, 1);
    const [tender] = this.tendersBySourceKey.values();
    return tender;
  }
}

function normalizedTender(overrides: Partial<NormalizedTenderDTO> = {}): NormalizedTenderDTO {
  return {
    externalPurchaseId: "32413500001",
    registryNumber: "32413500001",
    purchaseNumber: "32413500001",
    lotNumber: "1",
    sourceHash: "source-hash",
    sourceUrl: "https://zakupki.gov.ru/223/32413500001",
    platformName: "РТС-тендер",
    title: "Поставка расходных материалов",
    subjectDescription: "Расходные материалы",
    methodName: "Запрос котировок",
    statusName: "APPLICATION_SUBMISSION",
    customer: {
      name: "АО Заказчик",
      inn: "7701234567",
      kpp: null,
      address: null
    },
    price: {
      maxPrice: "1850000.00",
      priceFormula: null,
      currencyCode: "RUB"
    },
    security: {
      applicationSecurityAmount: null,
      contractSecurityAmount: null
    },
    deadlines: {
      applicationStartAt: null,
      applicationDeadlineAt: "2026-06-03T10:00:00+03:00",
      clarificationDeadlineAt: null,
      resultAt: null,
      publishedAt: "2026-05-20T10:00:00+03:00",
      updatedFromSourceAt: null
    },
    delivery: {
      deliveryPlace: null,
      deliveryPeriodText: null
    },
    region: {
      regionCode: "77",
      regionName: "Москва"
    },
    okpd2Codes: [],
    documents: [],
    requirements: [],
    criteria: [],
    changesFeed: [],
    sourcePayload: {
      purchase: {
        number: "32413500001",
        version: 1
      }
    },
    ...overrides
  };
}

test("cron authorization returns 401 for missing token and 403 for wrong token", () => {
  assert.deepEqual(validateCronAuthorization(null, "secret"), {
    ok: false,
    status: 401,
    message: "Missing Authorization bearer token."
  });
  assert.deepEqual(validateCronAuthorization("Bearer wrong", "secret"), {
    ok: false,
    status: 403,
    message: "Invalid cron token."
  });
  assert.deepEqual(validateCronAuthorization("Bearer secret", "secret"), {
    ok: true
  });
});

test("payload hash is stable for equivalent normalized source payloads", () => {
  const left = normalizedTender({
    sourcePayload: {
      purchase: {
        number: "32413500001",
        version: 1
      }
    }
  });
  const right = normalizedTender({
    sourcePayload: {
      purchase: {
        version: 1,
        number: "32413500001"
      }
    }
  });
  const changed = normalizedTender({
    sourcePayload: {
      purchase: {
        number: "32413500001",
        version: 2
      }
    }
  });

  assert.equal(computePayloadHash(left), computePayloadHash(right));
  assert.notEqual(computePayloadHash(left), computePayloadHash(changed));
});

test("document dedupe prefers external document id and falls back safely", () => {
  assert.equal(
    createDocumentDedupeKey({
      externalDocumentId: "doc-1",
      sourceHash: "hash-1",
      sourceUrl: "https://example.test/doc.pdf",
      title: "Документация"
    }),
    "external:doc-1"
  );
  assert.equal(
    createDocumentDedupeKey({
      externalDocumentId: null,
      sourceHash: "hash-1",
      sourceUrl: "https://example.test/doc.pdf",
      title: "Документация"
    }),
    "hash:hash-1"
  );
  assert.equal(
    createDocumentDedupeKey({
      externalDocumentId: null,
      sourceHash: null,
      sourceUrl: "https://example.test/doc.pdf",
      title: "Документация"
    }),
    "url:https://example.test/doc.pdf"
  );
  assert.match(
    createDocumentDedupeKey({
      externalDocumentId: null,
      sourceHash: null,
      sourceUrl: null,
      title: "Документация"
    }),
    /^title:[a-f0-9]{32}$/
  );
});

test("tender dedupe key is scoped by owner, purchase and lot", () => {
  assert.equal(
    createTenderSourceDedupeKey("user-1", "32413500001", "1"),
    "owner:user-1:external:32413500001:lot:1"
  );
  assert.notEqual(
    createTenderSourceDedupeKey("user-1", "32413500001", "1"),
    createTenderSourceDedupeKey("user-2", "32413500001", "1")
  );
});

test("repeated watchlist runs upsert without duplicating tenders or documents", async () => {
  const prisma = new RepeatRunPrismaFake();
  const dto = normalizedTender({
    documents: [
      {
        externalDocumentId: "notice-1",
        type: "NOTICE",
        title: "Извещение",
        fileName: "notice.pdf",
        sourceUrl: "https://example.test/notice.pdf",
        sourceHash: "notice-hash",
        publishedAt: "2026-05-20T10:00:00+03:00"
      }
    ]
  });
  const client: EIS223Client = {
    async search() {
      return {
        hits: [
          {
            provider: "eis223",
            law: "223-FZ",
            externalId: dto.externalPurchaseId,
            registryNumber: dto.registryNumber ?? dto.externalPurchaseId,
            title: dto.title,
            sourceStage: dto.statusName ?? "UNKNOWN",
            customerName: dto.customer.name ?? "Не указан",
            customerInn: dto.customer.inn,
            procurementMethod: dto.methodName,
            region: dto.region.regionName,
            okpd2Codes: dto.okpd2Codes,
            initialPrice: dto.price.maxPrice,
            currency: dto.price.currencyCode ?? "RUB",
            publishDate: dto.deadlines.publishedAt,
            applicationDeadlineAt: dto.deadlines.applicationDeadlineAt,
            detailUrl: dto.sourceUrl
          }
        ],
        nextCursor: null,
        providerMode: "fixture",
        sourceFreshness: {
          mode: "fixture",
          note: "test fixture"
        }
      };
    },
    async normalizePurchase() {
      return dto;
    }
  };

  const originalConsoleInfo = console.info;
  console.info = () => {};

  let firstRun: WatchlistRunSummary | null = null;
  let secondRun: WatchlistRunSummary | null = null;
  try {
    firstRun = await runWatchlists({
      prisma: prisma.asPrismaClient(),
      client,
      filterId: "filter-1",
      userId: "user-1",
      useLock: false
    });
    const tenderAfterFirstRun = prisma.onlyTender();
    tenderAfterFirstRun.kanbanStageId = "stage-user-moved";

    secondRun = await runWatchlists({
      prisma: prisma.asPrismaClient(),
      client,
      filterId: "filter-1",
      userId: "user-1",
      useLock: false
    });
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.equal(firstRun?.tendersCreated, 1);
  assert.equal(firstRun?.tendersUpdated, 0);
  assert.equal(secondRun?.tendersCreated, 0);
  assert.equal(secondRun?.tendersUpdated, 0);
  assert.equal(prisma.tendersBySourceKey.size, 1);
  assert.equal(prisma.documentsByTenderDedupeKey.size, 1);
  assert.equal(prisma.onlyTender().kanbanStageId, "stage-user-moved");
});

test("deriveSourceStage opens submission from notice or documentation before deadline", () => {
  const now = new Date("2026-05-25T12:00:00+03:00");
  const tender = normalizedTender({
    documents: [
      {
        externalDocumentId: "notice-1",
        type: "NOTICE",
        title: "Извещение",
        fileName: "notice.pdf",
        sourceUrl: "https://example.test/notice.pdf",
        sourceHash: null,
        publishedAt: null
      }
    ]
  });

  assert.equal(deriveSourceStage(tender, { now }), "SUBMISSION_OPEN");
});

test("deriveSourceStage separates protocol work from completed result protocols", () => {
  const now = new Date("2026-05-25T12:00:00+03:00");
  const protocolTender = normalizedTender({
    documents: [
      {
        externalDocumentId: "protocol-1",
        type: "PROTOCOL",
        title: "Протокол рассмотрения заявок",
        fileName: "protocol.pdf",
        sourceUrl: "https://example.test/protocol.pdf",
        sourceHash: null,
        publishedAt: null
      }
    ]
  });
  const resultTender = normalizedTender({
    documents: [
      {
        externalDocumentId: "result-1",
        type: "RESULT",
        title: "Итоги закупки",
        fileName: "result.pdf",
        sourceUrl: "https://example.test/result.pdf",
        sourceHash: null,
        publishedAt: null
      }
    ]
  });
  const finalProtocolTender = normalizedTender({
    documents: [
      {
        externalDocumentId: "protocol-final-1",
        type: "PROTOCOL",
        title: "Итоговый протокол",
        fileName: "final-protocol.pdf",
        sourceUrl: "https://example.test/final-protocol.pdf",
        sourceHash: null,
        publishedAt: null
      }
    ]
  });

  assert.equal(deriveSourceStage(protocolTender, { now }), "COMMISSION_WORK");
  assert.equal(deriveSourceStage(resultTender, { now }), "COMPLETED");
  assert.equal(deriveSourceStage(finalProtocolTender, { now }), "COMPLETED");
});

test("deriveSourceStage handles canceled, expired, and unknown sources", () => {
  const now = new Date("2026-06-05T12:00:00+03:00");
  const expiredTender = normalizedTender({
    statusName: "APPLICATION_SUBMISSION",
    deadlines: {
      applicationStartAt: null,
      applicationDeadlineAt: "2026-06-03T10:00:00+03:00",
      clarificationDeadlineAt: null,
      resultAt: null,
      publishedAt: "2026-05-20T10:00:00+03:00",
      updatedFromSourceAt: null
    },
    documents: [
      {
        externalDocumentId: "docs-1",
        type: "DOCUMENTATION",
        title: "Закупочная документация",
        fileName: "docs.pdf",
        sourceUrl: "https://example.test/docs.pdf",
        sourceHash: null,
        publishedAt: null
      }
    ]
  });
  const canceledTender = normalizedTender({
    statusName: "CANCELED_BY_CUSTOMER",
    documents: []
  });
  const unknownTender = normalizedTender({
    statusName: null,
    deadlines: {
      applicationStartAt: null,
      applicationDeadlineAt: null,
      clarificationDeadlineAt: null,
      resultAt: null,
      publishedAt: null,
      updatedFromSourceAt: null
    },
    documents: []
  });

  assert.equal(deriveSourceStage(canceledTender, { now }), "CANCELED");
  assert.equal(deriveSourceStage(expiredTender, { now }), "EXPIRED");
  assert.equal(deriveSourceStage(unknownTender, { now }), "UNKNOWN");
});
