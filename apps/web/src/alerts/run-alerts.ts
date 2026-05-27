import { randomUUID } from "node:crypto";
import {
  AlertChannel,
  AlertDeliveryType,
  Prisma,
  TenderSourceStage,
  type PrismaClient
} from "@prisma/client";
import {
  buildTenderDeepLink,
  createConfiguredAlertDeliveryAdapter,
  getAlertDeliveryMode,
  type AlertChannelValue,
  type AlertDeliveryAdapter,
  type AlertDeliveryResult,
  type AlertDeliveryWrite
} from "./delivery-adapters";
import { getPrismaClient } from "@/src/lib/prisma";
import { normalizeSavedFilterQuery } from "@/src/saved-filters/service";

const ALERTS_LOCK_NAME = "alerts.run";
const DEFAULT_LOCK_TTL_SECONDS = 15 * 60;
const DEFAULT_NEW_MATCH_LOOKBACK_HOURS = 24;

const DEFAULT_ALERT_CHANNELS: readonly AlertChannelValue[] = [AlertChannel.EMAIL];

const DEADLINE_BUCKETS = [
  {
    type: AlertDeliveryType.DEADLINE_T48,
    bucket: "t48",
    minHoursExclusive: 24,
    maxHoursInclusive: 48
  },
  {
    type: AlertDeliveryType.DEADLINE_T24,
    bucket: "t24",
    minHoursExclusive: 2,
    maxHoursInclusive: 24
  },
  {
    type: AlertDeliveryType.DEADLINE_T2,
    bucket: "t2",
    minHoursExclusive: 0,
    maxHoursInclusive: 2
  }
] as const;

type SavedFilterForAlerts = {
  id: string;
  userId: string;
  name: string;
  query: unknown;
};

type AlertTenderCandidate = {
  id: string;
  ownerId: string | null;
  registryNumber: string | null;
  title: string;
  description: string | null;
  customerInn: string | null;
  customerName: string | null;
  purchaseMethod: string | null;
  initialPrice: Prisma.Decimal | string | number | null;
  region: string | null;
  submissionDeadline: Date | null;
  bidSecurityAmount: Prisma.Decimal | string | number | null;
  contractSecurityAmount: Prisma.Decimal | string | number | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  sourceStage: TenderSourceStage | string;
};

export type AlertRunSummary = {
  filtersProcessed: number;
  tendersScanned: number;
  eventsGenerated: number;
  deliveriesCreated: number;
  duplicatesSkipped: number;
  deliveriesSent: number;
  deliveriesMocked: number;
  deliveriesStubbed: number;
  errorsCount: number;
};

export type RunAlertsOptions = {
  prisma?: PrismaClient;
  deliveryAdapter?: AlertDeliveryAdapter;
  channels?: AlertChannelValue[];
  now?: Date;
  newMatchLookbackHours?: number;
  useLock?: boolean;
};

export class AlertRunAlreadyInProgressError extends Error {
  constructor() {
    super("Alert execution is already running.");
    this.name = "AlertRunAlreadyInProgressError";
  }
}

type AlertRunLockLease = {
  name: string;
  ownerToken: string;
};

export function emptyAlertRunSummary(
  overrides: Partial<AlertRunSummary> = {}
): AlertRunSummary {
  return {
    filtersProcessed: 0,
    tendersScanned: 0,
    eventsGenerated: 0,
    deliveriesCreated: 0,
    duplicatesSkipped: 0,
    deliveriesSent: 0,
    deliveriesMocked: 0,
    deliveriesStubbed: 0,
    errorsCount: 0,
    ...overrides
  };
}

export function createAlertIdempotencyKey(input: {
  userId: string;
  tenderId: string;
  type: AlertDeliveryType;
  channel: AlertChannelValue;
  bucket: string;
}) {
  return [
    "alert",
    "v1",
    input.userId,
    input.tenderId,
    input.type,
    input.channel,
    input.bucket
  ].join(":");
}

function getLockTtlSeconds() {
  const rawTtl = process.env.ALERTS_LOCK_TTL_SECONDS;
  const ttl = rawTtl ? Number(rawTtl) : DEFAULT_LOCK_TTL_SECONDS;

  if (!Number.isInteger(ttl) || ttl < 30) {
    return DEFAULT_LOCK_TTL_SECONDS;
  }

  return ttl;
}

function getNewMatchLookbackHours(options: RunAlertsOptions) {
  const configured = options.newMatchLookbackHours;

  if (
    configured != null &&
    Number.isInteger(configured) &&
    configured > 0 &&
    configured <= 24 * 14
  ) {
    return configured;
  }

  const rawLookback = process.env.ALERT_NEW_MATCH_LOOKBACK_HOURS;
  const lookback = rawLookback ? Number(rawLookback) : DEFAULT_NEW_MATCH_LOOKBACK_HOURS;

  if (!Number.isInteger(lookback) || lookback < 1 || lookback > 24 * 14) {
    return DEFAULT_NEW_MATCH_LOOKBACK_HOURS;
  }

  return lookback;
}

function getChannels(options: RunAlertsOptions): AlertChannelValue[] {
  if (options.channels && options.channels.length > 0) {
    return uniqueChannels(options.channels);
  }

  const rawChannels = process.env.ALERT_DRY_RUN_CHANNELS;

  if (!rawChannels) {
    return [...DEFAULT_ALERT_CHANNELS];
  }

  const channels = rawChannels
    .split(",")
    .map((channel) => channel.trim().toUpperCase())
    .filter((channel): channel is AlertChannelValue =>
      channel === AlertChannel.EMAIL || channel === AlertChannel.TELEGRAM
    );

  return channels.length > 0 ? uniqueChannels(channels) : [...DEFAULT_ALERT_CHANNELS];
}

function uniqueChannels(channels: AlertChannelValue[]) {
  return Array.from(new Set(channels));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readRawAlertPreferences(rawQuery: unknown) {
  const query = asRecord(rawQuery);
  const nested = asRecord(query?.alertPreferences);

  return {
    notifyEmail: readBoolean(nested?.notifyEmail) ?? readBoolean(query?.notifyEmail),
    notifyTelegram: readBoolean(nested?.notifyTelegram) ?? readBoolean(query?.notifyTelegram)
  };
}

function getChannelsForAlertQuery(rawQuery: unknown): AlertChannelValue[] {
  const query = normalizeSavedFilterQuery(rawQuery);
  const rawPreferences = readRawAlertPreferences(rawQuery);
  const notifyEmail = rawPreferences.notifyEmail ?? query.notifyEmail;
  const notifyTelegram = rawPreferences.notifyTelegram ?? query.notifyTelegram;
  const channels: AlertChannelValue[] = [];

  if (notifyEmail) {
    channels.push(AlertChannel.EMAIL);
  }

  if (notifyTelegram) {
    channels.push(AlertChannel.TELEGRAM);
  }

  return uniqueChannels(channels);
}

function rememberUserChannels(
  channelsByUserId: Map<string, AlertChannelValue[]>,
  userId: string,
  channels: AlertChannelValue[]
) {
  if (!channelsByUserId.has(userId)) {
    channelsByUserId.set(userId, channels);
    return;
  }

  channelsByUserId.set(userId, uniqueChannels([...(channelsByUserId.get(userId) ?? []), ...channels]));
}

function toMoneyNumber(value: AlertTenderCandidate["initialPrice"]): number | null {
  if (value == null) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

function includesAny(value: string, candidates: string[]) {
  const normalizedValue = normalizeText(value);
  return candidates.some((candidate) => normalizedValue.includes(normalizeText(candidate)));
}

function matchesAnyConfiguredTerm(value: string | null, candidates: string[]) {
  if (candidates.length === 0) {
    return true;
  }

  return includesAny(value ?? "", candidates);
}

function buildSearchableText(tender: AlertTenderCandidate) {
  return [
    tender.registryNumber,
    tender.title,
    tender.description,
    tender.customerInn,
    tender.customerName,
    tender.purchaseMethod,
    tender.region
  ]
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .join(" ");
}

export function tenderMatchesSavedFilter(
  tender: AlertTenderCandidate,
  rawQuery: unknown,
  now = new Date()
) {
  const query = normalizeSavedFilterQuery(rawQuery);
  const searchableText = buildSearchableText(tender);
  const searchQuery = query.searchQuery.trim();

  if (searchQuery && !includesAny(searchableText, [searchQuery])) {
    return false;
  }

  if (query.includeKeywords.length > 0 && !includesAny(searchableText, query.includeKeywords)) {
    return false;
  }

  if (query.excludeKeywords.length > 0 && includesAny(searchableText, query.excludeKeywords)) {
    return false;
  }

  const initialPrice = toMoneyNumber(tender.initialPrice);

  if (query.minPrice != null && (initialPrice == null || initialPrice < query.minPrice)) {
    return false;
  }

  if (query.maxPrice != null && (initialPrice == null || initialPrice > query.maxPrice)) {
    return false;
  }

  if (!matchesAnyConfiguredTerm(tender.region, query.regionCodes)) {
    return false;
  }

  if (!matchesAnyConfiguredTerm(tender.purchaseMethod, query.methodAllowList)) {
    return false;
  }

  if (
    query.customerInnAllowList.length > 0 &&
    !query.customerInnAllowList.includes(tender.customerInn ?? "")
  ) {
    return false;
  }

  if (
    query.customerInnBlockList.length > 0 &&
    query.customerInnBlockList.includes(tender.customerInn ?? "")
  ) {
    return false;
  }

  if (query.daysAhead != null) {
    if (!tender.submissionDeadline) {
      return false;
    }

    const maxDeadline = now.getTime() + query.daysAhead * 24 * 60 * 60 * 1000;
    const deadlineTime = tender.submissionDeadline.getTime();

    if (deadlineTime < now.getTime() || deadlineTime > maxDeadline) {
      return false;
    }
  }

  if (query.onlyWithSecurity) {
    const bidSecurity = toMoneyNumber(tender.bidSecurityAmount) ?? 0;
    const contractSecurity = toMoneyNumber(tender.contractSecurityAmount) ?? 0;

    if (bidSecurity <= 0 && contractSecurity <= 0) {
      return false;
    }
  }

  return true;
}

function deadlineBucketFor(tender: AlertTenderCandidate, now: Date) {
  if (!tender.submissionDeadline) {
    return null;
  }

  const hoursLeft = (tender.submissionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  return (
    DEADLINE_BUCKETS.find(
      (bucket) =>
        hoursLeft > bucket.minHoursExclusive && hoursLeft <= bucket.maxHoursInclusive
    ) ?? null
  );
}

function compactTenderPayload(tender: AlertTenderCandidate) {
  const deepLink = buildTenderDeepLink(tender.id);

  return {
    id: tender.id,
    registryNumber: tender.registryNumber,
    customerName: tender.customerName,
    submissionDeadline: tender.submissionDeadline?.toISOString() ?? null,
    deepLink
  };
}

function formatAlertDeadline(value: Date | null) {
  if (!value) {
    return "Не указан";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function buildMessagePayload(input: {
  tender: AlertTenderCandidate;
  event: string;
}) {
  return {
    number: input.tender.registryNumber ?? "Без номера",
    customer: input.tender.customerName ?? "Заказчик не указан",
    event: input.event,
    deadline: formatAlertDeadline(input.tender.submissionDeadline),
    deepLink: buildTenderDeepLink(input.tender.id)
  } satisfies Prisma.InputJsonObject;
}

function buildNewMatchPayload(input: {
  tender: AlertTenderCandidate;
  filter: SavedFilterForAlerts;
  now: Date;
}) {
  return {
    version: "alert-v1",
    type: "new_match",
    generatedAt: input.now.toISOString(),
    deliveryMode: getAlertDeliveryMode(),
    tender: compactTenderPayload(input.tender),
    filter: {
      id: input.filter.id
    },
    message: buildMessagePayload({
      tender: input.tender,
      event: "New match"
    })
  } satisfies Prisma.InputJsonObject;
}

function buildDeadlinePayload(input: {
  tender: AlertTenderCandidate;
  now: Date;
  bucket: string;
}) {
  return {
    version: "alert-v1",
    type: `deadline_${input.bucket}`,
    generatedAt: input.now.toISOString(),
    deliveryMode: getAlertDeliveryMode(),
    tender: compactTenderPayload(input.tender),
    deadlineBucket: input.bucket,
    message: buildMessagePayload({
      tender: input.tender,
      event: `Deadline T-${input.bucket.replace("t", "")}h`
    })
  } satisfies Prisma.InputJsonObject;
}

function addEvent(
  deliveriesByKey: Map<string, AlertDeliveryWrite>,
  delivery: AlertDeliveryWrite
) {
  if (!deliveriesByKey.has(delivery.idempotencyKey)) {
    deliveriesByKey.set(delivery.idempotencyKey, delivery);
  }
}

function addNewMatchEvents(input: {
  deliveriesByKey: Map<string, AlertDeliveryWrite>;
  filter: SavedFilterForAlerts;
  tender: AlertTenderCandidate;
  channels: AlertChannelValue[];
  now: Date;
}) {
  for (const channel of input.channels) {
    const idempotencyKey = createAlertIdempotencyKey({
      userId: input.filter.userId,
      tenderId: input.tender.id,
      type: AlertDeliveryType.NEW_MATCH,
      channel,
      bucket: "new_match"
    });

    addEvent(input.deliveriesByKey, {
      userId: input.filter.userId,
      tenderId: input.tender.id,
      channel,
      type: AlertDeliveryType.NEW_MATCH,
      idempotencyKey,
      payload: buildNewMatchPayload(input),
      sentAt: null,
      errorMessage: null
    });
  }
}

function addDeadlineEvents(input: {
  deliveriesByKey: Map<string, AlertDeliveryWrite>;
  tender: AlertTenderCandidate;
  channels: AlertChannelValue[];
  now: Date;
}) {
  const bucket = deadlineBucketFor(input.tender, input.now);

  if (!bucket || !input.tender.ownerId || !input.tender.submissionDeadline) {
    return;
  }

  const deadlineKey = `deadline:${input.tender.submissionDeadline.toISOString()}:${bucket.bucket}`;

  for (const channel of input.channels) {
    const idempotencyKey = createAlertIdempotencyKey({
      userId: input.tender.ownerId,
      tenderId: input.tender.id,
      type: bucket.type,
      channel,
      bucket: deadlineKey
    });

    addEvent(input.deliveriesByKey, {
      userId: input.tender.ownerId,
      tenderId: input.tender.id,
      channel,
      type: bucket.type,
      idempotencyKey,
      payload: buildDeadlinePayload({
        tender: input.tender,
        now: input.now,
        bucket: bucket.bucket
      }),
      sentAt: null,
      errorMessage: null
    });
  }
}

async function findNewMatchEvents(input: {
  prisma: PrismaClient;
  channelsByUserId: Map<string, AlertChannelValue[]>;
  now: Date;
  lookbackHours: number;
  deliveriesByKey: Map<string, AlertDeliveryWrite>;
  summary: AlertRunSummary;
}) {
  const since = new Date(input.now.getTime() - input.lookbackHours * 60 * 60 * 1000);
  const filters = await input.prisma.savedFilter.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      userId: true,
      name: true,
      query: true
    }
  });

  for (const filter of filters) {
    const query = normalizeSavedFilterQuery(filter.query);
    const channels = getChannelsForAlertQuery(filter.query);
    rememberUserChannels(input.channelsByUserId, filter.userId, channels);

    if (!query.notifyOnNew) {
      continue;
    }

    input.summary.filtersProcessed += 1;

    const tenders = await input.prisma.tender.findMany({
      where: {
        ownerId: filter.userId,
        OR: [
          {
            createdAt: {
              gte: since
            }
          },
          {
            lastSeenAt: {
              gte: since
            }
          }
        ]
      },
      select: {
        id: true,
        ownerId: true,
        registryNumber: true,
        title: true,
        description: true,
        customerInn: true,
        customerName: true,
        purchaseMethod: true,
        initialPrice: true,
        region: true,
        submissionDeadline: true,
        bidSecurityAmount: true,
        contractSecurityAmount: true,
        createdAt: true,
        lastSeenAt: true,
        sourceStage: true
      }
    });

    input.summary.tendersScanned += tenders.length;

    for (const tender of tenders) {
      if (!tenderMatchesSavedFilter(tender, filter.query, input.now)) {
        continue;
      }

      addNewMatchEvents({
        deliveriesByKey: input.deliveriesByKey,
        filter,
        tender,
        channels,
        now: input.now
      });
    }
  }
}

async function findDeadlineEvents(input: {
  prisma: PrismaClient;
  defaultChannels: AlertChannelValue[];
  channelsByUserId: Map<string, AlertChannelValue[]>;
  now: Date;
  deliveriesByKey: Map<string, AlertDeliveryWrite>;
  summary: AlertRunSummary;
}) {
  const maxDeadline = new Date(input.now.getTime() + 48 * 60 * 60 * 1000);
  const tenders = await input.prisma.tender.findMany({
    where: {
      ownerId: {
        not: null
      },
      submissionDeadline: {
        gt: input.now,
        lte: maxDeadline
      },
      sourceStage: {
        notIn: [
          TenderSourceStage.COMPLETED,
          TenderSourceStage.CANCELED,
          TenderSourceStage.EXPIRED
        ]
      }
    },
    select: {
      id: true,
      ownerId: true,
      registryNumber: true,
      title: true,
      description: true,
      customerInn: true,
      customerName: true,
      purchaseMethod: true,
      initialPrice: true,
      region: true,
      submissionDeadline: true,
      bidSecurityAmount: true,
      contractSecurityAmount: true,
      createdAt: true,
      lastSeenAt: true,
      sourceStage: true
    }
  });

  input.summary.tendersScanned += tenders.length;

  for (const tender of tenders) {
    const channels =
      tender.ownerId && input.channelsByUserId.has(tender.ownerId)
        ? (input.channelsByUserId.get(tender.ownerId) ?? [])
        : input.defaultChannels;

    addDeadlineEvents({
      deliveriesByKey: input.deliveriesByKey,
      tender,
      channels,
      now: input.now
    });
  }
}

async function tryAcquireRunLock(prisma: PrismaClient): Promise<AlertRunLockLease | null> {
  const ownerToken = randomUUID();
  const ttlSeconds = getLockTtlSeconds();
  const [row] = await prisma.$queryRaw<Array<AlertRunLockLease>>`
    INSERT INTO "RuntimeLock" ("name", "ownerToken", "expiresAt", "createdAt", "updatedAt")
    VALUES (
      ${ALERTS_LOCK_NAME},
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

async function releaseRunLock(prisma: PrismaClient, lease: AlertRunLockLease) {
  await prisma.runtimeLock.deleteMany({
    where: {
      name: lease.name,
      ownerToken: lease.ownerToken
    }
  });
}

async function refreshRunLock(prisma: PrismaClient, lease: AlertRunLockLease) {
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
    throw new AlertRunAlreadyInProgressError();
  }
}

async function runWithoutLock(
  prisma: PrismaClient,
  deliveryAdapter: AlertDeliveryAdapter,
  options: RunAlertsOptions,
  lease?: AlertRunLockLease
) {
  const now = options.now ?? new Date();
  const defaultChannels = getChannels(options);
  const lookbackHours = getNewMatchLookbackHours(options);
  const summary = emptyAlertRunSummary();
  const deliveriesByKey = new Map<string, AlertDeliveryWrite>();
  const channelsByUserId = new Map<string, AlertChannelValue[]>();

  if (lease) {
    await refreshRunLock(prisma, lease);
  }

  await findNewMatchEvents({
    prisma,
    channelsByUserId,
    now,
    lookbackHours,
    deliveriesByKey,
    summary
  });

  if (lease) {
    await refreshRunLock(prisma, lease);
  }

  await findDeadlineEvents({
    prisma,
    defaultChannels,
    channelsByUserId,
    now,
    deliveriesByKey,
    summary
  });

  summary.eventsGenerated = deliveriesByKey.size;

  if (lease) {
    await refreshRunLock(prisma, lease);
  }

  const deliveryResult = await deliveryAdapter.deliver([...deliveriesByKey.values()]);
  summary.deliveriesCreated = deliveryResult.created;
  summary.duplicatesSkipped = deliveryResult.duplicatesSkipped;
  summary.deliveriesSent = deliveryResult.sent;
  summary.deliveriesMocked = deliveryResult.mocked;
  summary.deliveriesStubbed = deliveryResult.stubbed;
  summary.errorsCount = deliveryResult.failed;

  console.info("alerts.run.completed", summary);
  return summary;
}

export async function runAlerts(options: RunAlertsOptions = {}): Promise<AlertRunSummary> {
  const prisma = options.prisma ?? getPrismaClient();
  const deliveryAdapter = options.deliveryAdapter ?? createConfiguredAlertDeliveryAdapter(prisma);

  if (!options.useLock) {
    return runWithoutLock(prisma, deliveryAdapter, options);
  }

  const lease = await tryAcquireRunLock(prisma);

  if (!lease) {
    throw new AlertRunAlreadyInProgressError();
  }

  try {
    return await runWithoutLock(prisma, deliveryAdapter, options, lease);
  } finally {
    await releaseRunLock(prisma, lease);
  }
}
