import test from "node:test";
import assert from "node:assert/strict";
import {
  AlertChannel,
  AlertDeliveryType,
  TenderSourceStage,
  type PrismaClient
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { POST as postAlertsRun } from "../app/api/cron/alerts/run/route";
import {
  acknowledgeAlertForUser,
  type AcknowledgeAlertStore
} from "../src/alerts/acknowledge-alert";
import {
  createAlertIdempotencyKey,
  runAlerts,
  type AlertRunSummary
} from "../src/alerts/run-alerts";
import {
  buildSafeAlertMessage,
  PrismaAlertDeliveryAdapter,
  type AlertDeliveryWrite
} from "../src/alerts/delivery-adapters";
import { deriveAlertDeliveryDisplay } from "../src/alerts/delivery-status";
import { findTenderCardForUser } from "../src/tenders/tender-card-query";

type StoredSavedFilter = {
  id: string;
  userId: string;
  name: string;
  query: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StoredTender = {
  id: string;
  ownerId: string | null;
  registryNumber: string | null;
  title: string;
  description: string | null;
  customerInn: string | null;
  customerName: string | null;
  purchaseMethod: string | null;
  initialPrice: string | null;
  region: string | null;
  submissionDeadline: Date | null;
  bidSecurityAmount: string | null;
  contractSecurityAmount: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  sourceStage: TenderSourceStage;
};

type StoredAlertDelivery = AlertDeliveryWrite & {
  id?: string;
};

type StoredTenderCardAlert = {
  id: string;
  userId: string;
  tenderId: string;
  channel: AlertChannel;
  type: AlertDeliveryType;
  sentAt: Date | null;
  acknowledgedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};

type TenderCardFindFirstArgs = {
  where: {
    id: string;
    ownerId: string;
  };
  select: {
    alertDeliveries: {
      where?: {
        userId?: string;
      };
    };
  };
};

type FetchMock = typeof globalThis.fetch;

class AlertPrismaFake {
  readonly savedFilters: StoredSavedFilter[];
  readonly tenders: StoredTender[];
  readonly deliveriesByKey = new Map<string, StoredAlertDelivery>();
  private nextAlertId = 1;

  constructor(input: { savedFilters?: StoredSavedFilter[]; tenders?: StoredTender[] } = {}) {
    this.savedFilters = input.savedFilters ?? [];
    this.tenders = input.tenders ?? [];
  }

  readonly savedFilter = {
    findMany: async (args: { where?: { isActive?: boolean } }) => {
      return this.savedFilters.filter((filter) => {
        if (args.where?.isActive != null && filter.isActive !== args.where.isActive) {
          return false;
        }

        return true;
      });
    },
    findFirst: async (args: { where?: { id?: string; userId?: string } }) => {
      return (
        this.savedFilters.find((filter) => {
          if (args.where?.id != null && filter.id !== args.where.id) {
            return false;
          }

          if (args.where?.userId != null && filter.userId !== args.where.userId) {
            return false;
          }

          return true;
        }) ?? null
      );
    }
  };

  readonly user = {
    findUnique: async () => ({
      email: "dev.supplier@example.local",
      companyProfile: {
        alertPreferences: {
          telegramChatId: "chat-from-profile"
        }
      }
    })
  };

  readonly tender = {
    findMany: async (args: {
      where?: {
        ownerId?: string | { not: null };
        OR?: Array<{ createdAt?: { gte: Date }; lastSeenAt?: { gte: Date } }>;
        submissionDeadline?: { gt: Date; lte: Date };
        sourceStage?: { notIn: TenderSourceStage[] };
      };
    }) => {
      const where = args.where ?? {};

      return this.tenders.filter((tender) => {
        if (typeof where.ownerId === "string" && tender.ownerId !== where.ownerId) {
          return false;
        }

        if (typeof where.ownerId === "object" && where.ownerId?.not === null && !tender.ownerId) {
          return false;
        }

        if (where.OR) {
          const matchesRecent = where.OR.some((branch) => {
            if (branch.createdAt) {
              return tender.createdAt >= branch.createdAt.gte;
            }

            if (branch.lastSeenAt) {
              return Boolean(tender.lastSeenAt && tender.lastSeenAt >= branch.lastSeenAt.gte);
            }

            return false;
          });

          if (!matchesRecent) {
            return false;
          }
        }

        if (where.submissionDeadline) {
          if (!tender.submissionDeadline) {
            return false;
          }

          if (
            tender.submissionDeadline <= where.submissionDeadline.gt ||
            tender.submissionDeadline > where.submissionDeadline.lte
          ) {
            return false;
          }
        }

        if (where.sourceStage?.notIn.includes(tender.sourceStage)) {
          return false;
        }

        return true;
      });
    }
  };

  readonly alertDelivery = {
    create: async (args: { data: StoredAlertDelivery; select: { id: true } }) => {
      if (this.deliveriesByKey.has(args.data.idempotencyKey)) {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }

      const id = `alert-${this.nextAlertId}`;
      this.nextAlertId += 1;
      this.deliveriesByKey.set(args.data.idempotencyKey, {
        ...args.data,
        id
      });

      return { id };
    },
    update: async (args: {
      where: { id: string };
      data: { sentAt?: Date | null; errorMessage?: string | null };
      select: { id: true };
    }) => {
      const entry = [...this.deliveriesByKey.entries()].find(
        ([, delivery]) => delivery.id === args.where.id
      );

      if (!entry) {
        throw new Error(`Unknown alert delivery ${args.where.id}`);
      }

      this.deliveriesByKey.set(entry[0], {
        ...entry[1],
        ...args.data
      });

      return { id: args.where.id };
    },
    createMany: async (args: { data: StoredAlertDelivery[]; skipDuplicates: boolean }) => {
      let count = 0;

      for (const delivery of args.data) {
        if (args.skipDuplicates && this.deliveriesByKey.has(delivery.idempotencyKey)) {
          continue;
        }

        this.deliveriesByKey.set(delivery.idempotencyKey, delivery);
        count += 1;
      }

      return { count };
    }
  };

  asPrismaClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }
}

class AcknowledgeStoreFake implements AcknowledgeAlertStore {
  acknowledgedCount = 0;

  constructor(private readonly ownerId: string) {}

  async findOwnedTender(tenderId: string, userId: string) {
    if (this.ownerId !== userId) {
      return null;
    }

    return {
      id: tenderId,
      ownerId: this.ownerId
    };
  }

  async acknowledgeAlerts() {
    this.acknowledgedCount += 1;
    return { count: 1 };
  }
}

class TenderCardPrismaFake {
  lastArgs: TenderCardFindFirstArgs | null = null;

  constructor(
    private readonly tenderRecord: { id: string; ownerId: string },
    private readonly alertDeliveries: StoredTenderCardAlert[]
  ) {}

  readonly tender = {
    findFirst: async (args: TenderCardFindFirstArgs) => {
      this.lastArgs = args;

      if (
        args.where.id !== this.tenderRecord.id ||
        args.where.ownerId !== this.tenderRecord.ownerId
      ) {
        return null;
      }

      const alertUserId = args.select.alertDeliveries.where?.userId;
      const alerts = this.alertDeliveries
        .filter((alert) => alert.tenderId === this.tenderRecord.id)
        .filter((alert) => !alertUserId || alert.userId === alertUserId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 12)
        .map(({ userId: _userId, tenderId: _tenderId, ...alert }) => alert);

      return {
        id: this.tenderRecord.id,
        alertDeliveries: alerts
      };
    }
  };

  asPrismaClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }
}

function hoursFrom(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function filter(overrides: Partial<StoredSavedFilter> = {}): StoredSavedFilter {
  return {
    id: "filter-1",
    userId: "user-1",
    name: "Dental watchlist",
    query: {
      searchQuery: "dental",
      notifyOnNew: true
    },
    isActive: true,
    createdAt: new Date("2026-05-26T09:00:00.000Z"),
    updatedAt: new Date("2026-05-26T09:00:00.000Z"),
    ...overrides
  };
}

function tender(overrides: Partial<StoredTender> = {}): StoredTender {
  const now = new Date("2026-05-27T09:00:00.000Z");

  return {
    id: "tender-1",
    ownerId: "user-1",
    registryNumber: "32413500001",
    title: "Dental consumables",
    description: null,
    customerInn: "7701234567",
    customerName: "AO Customer",
    purchaseMethod: "Electronic auction",
    initialPrice: "1500000",
    region: "Москва",
    submissionDeadline: hoursFrom(now, 240),
    bidSecurityAmount: null,
    contractSecurityAmount: null,
    createdAt: hoursFrom(now, -2),
    lastSeenAt: hoursFrom(now, -1),
    sourceStage: TenderSourceStage.SUBMISSION_OPEN,
    ...overrides
  };
}

async function runWithConsoleSilenced(run: () => Promise<AlertRunSummary>) {
  const originalInfo = console.info;
  const originalDeliveryMode = process.env.ALERT_DELIVERY_MODE;
  const originalBaseUrl = process.env.APP_BASE_URL;
  const originalChannels = process.env.ALERT_DRY_RUN_CHANNELS;
  console.info = () => {};
  process.env.ALERT_DELIVERY_MODE = "mock";
  process.env.APP_BASE_URL = "http://app.test";
  process.env.ALERT_DRY_RUN_CHANNELS = "EMAIL";

  try {
    return await run();
  } finally {
    console.info = originalInfo;
    if (originalDeliveryMode == null) {
      delete process.env.ALERT_DELIVERY_MODE;
    } else {
      process.env.ALERT_DELIVERY_MODE = originalDeliveryMode;
    }

    if (originalBaseUrl == null) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalBaseUrl;
    }

    if (originalChannels == null) {
      delete process.env.ALERT_DRY_RUN_CHANNELS;
    } else {
      process.env.ALERT_DRY_RUN_CHANNELS = originalChannels;
    }
  }
}

async function withConsoleInfoSilenced<T>(run: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  console.info = () => {};

  try {
    return await run();
  } finally {
    console.info = originalInfo;
  }
}

function restoreEnvValue(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test("alert delivery idempotency skips duplicate new_match records on repeat runs", async () => {
  const now = new Date("2026-05-27T09:00:00.000Z");
  const prisma = new AlertPrismaFake({
    savedFilters: [filter()],
    tenders: [tender()]
  });

  const firstRun = await runWithConsoleSilenced(() =>
    runAlerts({
      prisma: prisma.asPrismaClient(),
      now,
      channels: [AlertChannel.EMAIL],
      useLock: false
    })
  );
  const secondRun = await runWithConsoleSilenced(() =>
    runAlerts({
      prisma: prisma.asPrismaClient(),
      now,
      channels: [AlertChannel.EMAIL],
      useLock: false
    })
  );

  const expectedKey = createAlertIdempotencyKey({
    userId: "user-1",
    tenderId: "tender-1",
    type: AlertDeliveryType.NEW_MATCH,
    channel: AlertChannel.EMAIL,
    bucket: "new_match"
  });
  const delivery = prisma.deliveriesByKey.get(expectedKey);

  assert.equal(firstRun.deliveriesCreated, 1);
  assert.equal(firstRun.deliveriesMocked, 1);
  assert.equal(secondRun.deliveriesCreated, 0);
  assert.equal(secondRun.duplicatesSkipped, 1);
  assert.equal(prisma.deliveriesByKey.size, 1);
  assert.equal(delivery?.sentAt, null);
  assert.equal(delivery?.errorMessage, null);
  assert.equal((delivery?.payload as { deliveryMode?: string }).deliveryMode, "mock");

  assert.ok(delivery);
  const message = buildSafeAlertMessage(delivery);
  assert.match(message.text, /Number: 32413500001/);
  assert.match(message.text, /Customer: AO Customer/);
  assert.match(message.text, /Event: New match/);
  assert.match(message.text, /Link: http:\/\/app\.test\/tenders\/tender-1/);
  assert.equal(message.text.includes("Dental consumables"), false);
  assert.equal(message.text.includes("sourcePayload"), false);
  assert.equal(message.text.includes("AI raw"), false);
});

test("alert run uses saved filter delivery channel preferences", async () => {
  const now = new Date("2026-05-27T09:00:00.000Z");
  const prisma = new AlertPrismaFake({
    savedFilters: [
      filter({
        query: {
          searchQuery: "dental",
          notifyOnNew: true,
          notifyEmail: false,
          alertPreferences: {
            notifyTelegram: true
          }
        }
      })
    ],
    tenders: [tender()]
  });

  const summary = await runWithConsoleSilenced(() =>
    runAlerts({
      prisma: prisma.asPrismaClient(),
      now,
      useLock: false
    })
  );
  const deliveries = [...prisma.deliveriesByKey.values()];

  assert.equal(summary.deliveriesCreated, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.channel, AlertChannel.TELEGRAM);
});

test("email live delivery records a typed failed result when provider fetch throws", async () => {
  const originalFetch = globalThis.fetch;
  const originalDeliveryMode = process.env.ALERT_DELIVERY_MODE;
  const originalBaseUrl = process.env.APP_BASE_URL;
  const originalEmailApiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const now = new Date("2026-05-27T09:00:00.000Z");
  const prisma = new AlertPrismaFake({
    savedFilters: [filter()],
    tenders: [tender()]
  });

  process.env.ALERT_DELIVERY_MODE = "live";
  process.env.APP_BASE_URL = "http://app.test";
  process.env.EMAIL_PROVIDER_API_KEY = "email-secret-token";
  globalThis.fetch = (async () => {
    throw new Error("raw provider failure with email-secret-token and sourcePayload");
  }) as FetchMock;

  try {
    const summary = await withConsoleInfoSilenced(() =>
      runAlerts({
        prisma: prisma.asPrismaClient(),
        deliveryAdapter: new PrismaAlertDeliveryAdapter(prisma.asPrismaClient(), "live"),
        now,
        channels: [AlertChannel.EMAIL],
        useLock: false
      })
    );
    const delivery = [...prisma.deliveriesByKey.values()][0];

    assert.equal(summary.deliveriesCreated, 1);
    assert.equal(summary.errorsCount, 1);
    assert.equal(summary.deliveriesSent, 0);
    assert.equal(delivery?.sentAt, null);
    assert.equal(delivery?.errorMessage, "Email provider request failed before response.");
    assert.equal(delivery?.errorMessage?.includes("email-secret-token"), false);
    assert.equal(delivery?.errorMessage?.includes("sourcePayload"), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvValue("ALERT_DELIVERY_MODE", originalDeliveryMode);
    restoreEnvValue("APP_BASE_URL", originalBaseUrl);
    restoreEnvValue("EMAIL_PROVIDER_API_KEY", originalEmailApiKey);
  }
});

test("telegram live delivery records a typed failed result when provider fetch throws", async () => {
  const originalFetch = globalThis.fetch;
  const originalDeliveryMode = process.env.ALERT_DELIVERY_MODE;
  const originalBaseUrl = process.env.APP_BASE_URL;
  const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalTelegramChatId = process.env.TELEGRAM_CHAT_ID;
  const now = new Date("2026-05-27T09:00:00.000Z");
  const prisma = new AlertPrismaFake({
    savedFilters: [
      filter({
        query: {
          searchQuery: "dental",
          notifyOnNew: true,
          notifyEmail: false,
          notifyTelegram: true
        }
      })
    ],
    tenders: [tender()]
  });

  process.env.ALERT_DELIVERY_MODE = "live";
  process.env.APP_BASE_URL = "http://app.test";
  process.env.TELEGRAM_BOT_TOKEN = "telegram-secret-token";
  process.env.TELEGRAM_CHAT_ID = "telegram-chat-1";
  globalThis.fetch = (async () => {
    throw new Error("raw Telegram failure with telegram-secret-token and AI raw response");
  }) as FetchMock;

  try {
    const summary = await withConsoleInfoSilenced(() =>
      runAlerts({
        prisma: prisma.asPrismaClient(),
        deliveryAdapter: new PrismaAlertDeliveryAdapter(prisma.asPrismaClient(), "live"),
        now,
        useLock: false
      })
    );
    const delivery = [...prisma.deliveriesByKey.values()][0];

    assert.equal(summary.deliveriesCreated, 1);
    assert.equal(summary.errorsCount, 1);
    assert.equal(summary.deliveriesSent, 0);
    assert.equal(delivery?.channel, AlertChannel.TELEGRAM);
    assert.equal(delivery?.sentAt, null);
    assert.equal(delivery?.errorMessage, "Telegram provider request failed before response.");
    assert.equal(delivery?.errorMessage?.includes("telegram-secret-token"), false);
    assert.equal(delivery?.errorMessage?.includes("AI raw response"), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvValue("ALERT_DELIVERY_MODE", originalDeliveryMode);
    restoreEnvValue("APP_BASE_URL", originalBaseUrl);
    restoreEnvValue("TELEGRAM_BOT_TOKEN", originalTelegramToken);
    restoreEnvValue("TELEGRAM_CHAT_ID", originalTelegramChatId);
  }
});

test("alert history status derivation labels mock, stub, sent, failed, and pending states", () => {
  assert.deepEqual(
    deriveAlertDeliveryDisplay({
      sentAt: null,
      errorMessage: null
    }),
    {
      mode: "mock",
      status: "mocked"
    }
  );
  assert.deepEqual(
    deriveAlertDeliveryDisplay({
      sentAt: null,
      errorMessage: "Email live delivery skipped: EMAIL_PROVIDER_API_KEY is not configured."
    }),
    {
      mode: "stub",
      status: "stubbed"
    }
  );
  assert.deepEqual(
    deriveAlertDeliveryDisplay({
      sentAt: new Date("2026-05-27T10:00:00.000Z"),
      errorMessage: null
    }),
    {
      mode: "live",
      status: "sent"
    }
  );
  assert.deepEqual(
    deriveAlertDeliveryDisplay({
      sentAt: null,
      errorMessage: "Telegram provider request failed before response."
    }),
    {
      mode: "live",
      status: "failed"
    }
  );
});

test("deadline alert generation assigns non-overlapping t48, t24, and t2 buckets", async () => {
  const now = new Date("2026-05-27T09:00:00.000Z");
  const prisma = new AlertPrismaFake({
    tenders: [
      tender({ id: "tender-t48", title: "T48", submissionDeadline: hoursFrom(now, 47) }),
      tender({ id: "tender-t24", title: "T24", submissionDeadline: hoursFrom(now, 23) }),
      tender({ id: "tender-t2", title: "T2", submissionDeadline: hoursFrom(now, 1.5) }),
      tender({ id: "tender-too-late", title: "Too late", submissionDeadline: hoursFrom(now, 49) }),
      tender({
        id: "tender-completed",
        title: "Completed",
        submissionDeadline: hoursFrom(now, 23),
        sourceStage: TenderSourceStage.COMPLETED
      })
    ]
  });

  const summary = await runWithConsoleSilenced(() =>
    runAlerts({
      prisma: prisma.asPrismaClient(),
      now,
      channels: [AlertChannel.EMAIL],
      useLock: false
    })
  );
  const types = new Set([...prisma.deliveriesByKey.values()].map((delivery) => delivery.type));

  assert.equal(summary.deliveriesCreated, 3);
  assert.deepEqual(types, new Set([
    AlertDeliveryType.DEADLINE_T48,
    AlertDeliveryType.DEADLINE_T24,
    AlertDeliveryType.DEADLINE_T2
  ]));
});

test("alerts cron route rejects unauthorized requests and returns a safe summary", async () => {
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-secret";

  try {
    const missingResponse = await postAlertsRun(new Request("http://localhost/api/cron/alerts/run", {
      method: "POST"
    }) as unknown as NextRequest);
    const wrongResponse = await postAlertsRun(new Request("http://localhost/api/cron/alerts/run", {
      method: "POST",
      headers: {
        authorization: "Bearer leaked-secret"
      }
    }) as unknown as NextRequest);
    const wrongBody = await wrongResponse.json();
    const serialized = JSON.stringify(wrongBody);

    assert.equal(missingResponse.status, 401);
    assert.equal(wrongResponse.status, 403);
    assert.equal(wrongBody.errorsCount, 1);
    assert.equal(wrongBody.eventsGenerated, 0);
    assert.equal(serialized.includes("correct-secret"), false);
    assert.equal(serialized.includes("leaked-secret"), false);
    assert.equal(serialized.includes("payload"), false);
  } finally {
    if (originalSecret == null) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  }
});

test("acknowledgeAlertForUser rejects tenders owned by another user", async () => {
  const store = new AcknowledgeStoreFake("user-2");
  const result = await acknowledgeAlertForUser(store, "user-1", {
    tenderId: "tender-1",
    channel: AlertChannel.EMAIL,
    type: AlertDeliveryType.DEADLINE_T24
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected ownership check to fail.");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.acknowledgedCount, 0);
});

test("tender card alert history query returns only alerts for the current user", async () => {
  const prisma = new TenderCardPrismaFake(
    {
      id: "tender-1",
      ownerId: "user-1"
    },
    [
      {
        id: "alert-other-user",
        userId: "user-2",
        tenderId: "tender-1",
        channel: AlertChannel.EMAIL,
        type: AlertDeliveryType.DEADLINE_T24,
        sentAt: null,
        acknowledgedAt: null,
        errorMessage: "should not render",
        createdAt: new Date("2026-05-27T11:00:00.000Z")
      },
      {
        id: "alert-current-user",
        userId: "user-1",
        tenderId: "tender-1",
        channel: AlertChannel.EMAIL,
        type: AlertDeliveryType.NEW_MATCH,
        sentAt: null,
        acknowledgedAt: null,
        errorMessage: null,
        createdAt: new Date("2026-05-27T10:00:00.000Z")
      }
    ]
  );

  const tenderCard = await findTenderCardForUser(prisma.asPrismaClient(), "tender-1", "user-1");

  assert.deepEqual(prisma.lastArgs?.select.alertDeliveries.where, {
    userId: "user-1"
  });
  assert.deepEqual(
    tenderCard?.alertDeliveries.map((alert) => alert.id),
    ["alert-current-user"]
  );
});
