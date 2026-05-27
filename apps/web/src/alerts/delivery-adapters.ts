import {
  AlertChannel,
  AlertDeliveryType,
  Prisma,
  type PrismaClient
} from "@prisma/client";

export type AlertChannelValue = AlertChannel;

export type AlertDeliveryWrite = {
  userId: string;
  tenderId: string;
  channel: AlertChannelValue;
  type: AlertDeliveryType;
  idempotencyKey: string;
  payload: Prisma.InputJsonValue;
  sentAt: Date | null;
  errorMessage: string | null;
};

export type AlertDeliveryAttemptStatus =
  | "duplicate"
  | "failed"
  | "mocked"
  | "sent"
  | "stubbed";

export type AlertDeliveryAttempt = {
  idempotencyKey: string;
  channel: AlertChannelValue;
  type: AlertDeliveryType;
  status: AlertDeliveryAttemptStatus;
  sentAt: Date | null;
  errorMessage: string | null;
};

export type AlertDeliveryResult = {
  attempted: number;
  created: number;
  duplicatesSkipped: number;
  sent: number;
  mocked: number;
  stubbed: number;
  failed: number;
  attempts: AlertDeliveryAttempt[];
};

export type AlertDeliveryAdapter = {
  deliver(deliveries: AlertDeliveryWrite[]): Promise<AlertDeliveryResult>;
};

type SafeAlertMessage = {
  number: string;
  customer: string;
  event: string;
  deadline: string;
  deepLink: string;
  subject: string;
  text: string;
};

type ChannelDeliveryInput = {
  prisma: PrismaClient;
  delivery: AlertDeliveryWrite;
  message: SafeAlertMessage;
  mode: AlertDeliveryMode;
};

type ChannelDeliveryResult = {
  status: Exclude<AlertDeliveryAttemptStatus, "duplicate">;
  sentAt: Date | null;
  errorMessage: string | null;
};

type ChannelDeliveryAdapter = {
  send(input: ChannelDeliveryInput): Promise<ChannelDeliveryResult>;
};

export type AlertDeliveryMode = "live" | "mock";

const DEFAULT_APP_BASE_URL = "http://localhost:3000";

const alertTypeLabels: Record<AlertDeliveryType, string> = {
  [AlertDeliveryType.NEW_MATCH]: "New match",
  [AlertDeliveryType.DEADLINE_T48]: "Deadline T-48h",
  [AlertDeliveryType.DEADLINE_T24]: "Deadline T-24h",
  [AlertDeliveryType.DEADLINE_T2]: "Deadline T-2h",
  [AlertDeliveryType.NEW_CHANGE]: "New change",
  [AlertDeliveryType.NEW_CLARIFICATION]: "New clarification",
  [AlertDeliveryType.STAGE_SLA_BREACH]: "Stage SLA breach"
};

function emptyDeliveryResult(attempted: number): AlertDeliveryResult {
  return {
    attempted,
    created: 0,
    duplicatesSkipped: 0,
    sent: 0,
    mocked: 0,
    stubbed: 0,
    failed: 0,
    attempts: []
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function compactText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function formatDeadline(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Не указан";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return compactText(value, "Не указан", 80);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function sanitizeBaseUrl(rawBaseUrl: string | undefined) {
  const fallback = DEFAULT_APP_BASE_URL;
  const candidate = rawBaseUrl?.trim() || process.env.NEXTAUTH_URL?.trim() || fallback;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fallback;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function getAppBaseUrl() {
  return sanitizeBaseUrl(process.env.APP_BASE_URL);
}

export function buildTenderDeepLink(tenderId: string) {
  return `${getAppBaseUrl()}/tenders/${encodeURIComponent(tenderId)}`;
}

export function getAlertDeliveryMode(): AlertDeliveryMode {
  return process.env.ALERT_DELIVERY_MODE === "live" ? "live" : "mock";
}

function safePayloadWithDeliveryMode(
  delivery: AlertDeliveryWrite,
  mode: AlertDeliveryMode
): Prisma.InputJsonValue {
  const payload = asRecord(delivery.payload);

  return {
    ...(payload ?? {}),
    deliveryMode: mode,
    message: {
      ...((asRecord(payload?.message) ?? {}) as Prisma.InputJsonObject),
      deepLink: buildTenderDeepLink(delivery.tenderId)
    }
  } satisfies Prisma.InputJsonObject;
}

export function buildSafeAlertMessage(delivery: AlertDeliveryWrite): SafeAlertMessage {
  const payload = asRecord(delivery.payload);
  const message = asRecord(payload?.message);
  const tender = asRecord(payload?.tender);
  const registryNumber = compactText(
    message?.number ?? message?.registryNumber ?? tender?.registryNumber,
    "Без номера",
    80
  );
  const customer = compactText(
    message?.customer ?? message?.customerName ?? tender?.customerName,
    "Заказчик не указан",
    120
  );
  const event = compactText(message?.event, alertTypeLabels[delivery.type], 80);
  const deadline = compactText(
    message?.deadline ?? formatDeadline(tender?.submissionDeadline),
    "Не указан",
    80
  );
  const deepLink = compactText(message?.deepLink, buildTenderDeepLink(delivery.tenderId), 240);
  const subject = `223-ФЗ: ${event} ${registryNumber}`;
  const text = [
    "223-ФЗ alert",
    `Number: ${registryNumber}`,
    `Customer: ${customer}`,
    `Event: ${event}`,
    `Deadline: ${deadline}`,
    `Link: ${deepLink}`
  ].join("\n");

  return {
    number: registryNumber,
    customer,
    event,
    deadline,
    deepLink,
    subject,
    text
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
  );
}

function countAttempt(result: AlertDeliveryResult, attempt: AlertDeliveryAttempt) {
  result.attempts.push(attempt);

  if (attempt.status === "duplicate") {
    result.duplicatesSkipped += 1;
  } else {
    result[attempt.status] += 1;
  }
}

async function findRecipientUser(prisma: PrismaClient, userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      email: true,
      companyProfile: true
    }
  });
}

function getEmailProviderFromAddress() {
  return process.env.EMAIL_FROM?.trim() || "alerts@operational-workspace.local";
}

function providerRuntimeFailure(channel: "Email" | "Telegram"): ChannelDeliveryResult {
  return {
    status: "failed",
    sentAt: null,
    errorMessage: `${channel} provider request failed before response.`
  };
}

class EmailAlertChannelAdapter implements ChannelDeliveryAdapter {
  async send(input: ChannelDeliveryInput): Promise<ChannelDeliveryResult> {
    if (input.mode === "mock") {
      return {
        status: "mocked",
        sentAt: null,
        errorMessage: null
      };
    }

    const apiKey = process.env.EMAIL_PROVIDER_API_KEY?.trim();

    if (!apiKey) {
      return {
        status: "stubbed",
        sentAt: null,
        errorMessage: "Email live delivery skipped: EMAIL_PROVIDER_API_KEY is not configured."
      };
    }

    const recipient = await findRecipientUser(input.prisma, input.delivery.userId);
    const to = recipient?.email?.trim();

    if (!to) {
      return {
        status: "stubbed",
        sentAt: null,
        errorMessage: "Email live delivery skipped: user email is not configured."
      };
    }

    let response: Response;

    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from: getEmailProviderFromAddress(),
          to: [to],
          subject: input.message.subject,
          text: input.message.text
        })
      });
    } catch {
      return providerRuntimeFailure("Email");
    }

    if (!response.ok) {
      return {
        status: "failed",
        sentAt: null,
        errorMessage: `Email provider rejected request with HTTP ${response.status}.`
      };
    }

    return {
      status: "sent",
      sentAt: new Date(),
      errorMessage: null
    };
  }
}

function readAlertPreferences(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return asRecord(record.alertPreferences) ?? record;
}

function readStringPreference(value: unknown, key: string) {
  const preferences = readAlertPreferences(value);
  const candidate = preferences?.[key];

  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

async function findTelegramChatId(prisma: PrismaClient, delivery: AlertDeliveryWrite) {
  const envChatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (envChatId) {
    return envChatId;
  }

  const user = await findRecipientUser(prisma, delivery.userId);
  const userChatId = readStringPreference(user?.companyProfile, "telegramChatId");

  if (userChatId) {
    return userChatId;
  }

  const payload = asRecord(delivery.payload);
  const filter = asRecord(payload?.filter);
  const filterId = typeof filter?.id === "string" ? filter.id : null;

  if (!filterId) {
    return null;
  }

  const savedFilter = await prisma.savedFilter.findFirst({
    where: {
      id: filterId,
      userId: delivery.userId
    },
    select: {
      query: true
    }
  });

  return readStringPreference(savedFilter?.query, "telegramChatId");
}

class TelegramAlertChannelAdapter implements ChannelDeliveryAdapter {
  async send(input: ChannelDeliveryInput): Promise<ChannelDeliveryResult> {
    if (input.mode === "mock") {
      return {
        status: "mocked",
        sentAt: null,
        errorMessage: null
      };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      return {
        status: "stubbed",
        sentAt: null,
        errorMessage: "Telegram live delivery skipped: TELEGRAM_BOT_TOKEN is not configured."
      };
    }

    const chatId = await findTelegramChatId(input.prisma, input.delivery);

    if (!chatId) {
      return {
        status: "stubbed",
        sentAt: null,
        errorMessage: "Telegram live delivery skipped: telegramChatId is not configured."
      };
    }

    let response: Response;

    try {
      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: input.message.text,
          disable_web_page_preview: true
        })
      });
    } catch {
      return providerRuntimeFailure("Telegram");
    }

    if (!response.ok) {
      return {
        status: "failed",
        sentAt: null,
        errorMessage: `Telegram provider rejected request with HTTP ${response.status}.`
      };
    }

    return {
      status: "sent",
      sentAt: new Date(),
      errorMessage: null
    };
  }
}

export class PrismaAlertDeliveryAdapter implements AlertDeliveryAdapter {
  private readonly channelAdapters: Record<AlertChannelValue, ChannelDeliveryAdapter>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly mode: AlertDeliveryMode = getAlertDeliveryMode()
  ) {
    this.channelAdapters = {
      [AlertChannel.EMAIL]: new EmailAlertChannelAdapter(),
      [AlertChannel.TELEGRAM]: new TelegramAlertChannelAdapter()
    };
  }

  async deliver(deliveries: AlertDeliveryWrite[]): Promise<AlertDeliveryResult> {
    const result = emptyDeliveryResult(deliveries.length);

    for (const delivery of deliveries) {
      const safeDelivery = {
        ...delivery,
        payload: safePayloadWithDeliveryMode(delivery, this.mode)
      };

      let created: { id: string };

      try {
        created = await this.prisma.alertDelivery.create({
          data: safeDelivery,
          select: {
            id: true
          }
        });
        result.created += 1;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          countAttempt(result, {
            idempotencyKey: delivery.idempotencyKey,
            channel: delivery.channel,
            type: delivery.type,
            status: "duplicate",
            sentAt: null,
            errorMessage: null
          });
          continue;
        }

        throw error;
      }

      const channelResult = await this.channelAdapters[safeDelivery.channel].send({
        prisma: this.prisma,
        delivery: safeDelivery,
        message: buildSafeAlertMessage(safeDelivery),
        mode: this.mode
      });

      await this.prisma.alertDelivery.update({
        where: {
          id: created.id
        },
        data: {
          sentAt: channelResult.sentAt,
          errorMessage: channelResult.errorMessage
        },
        select: {
          id: true
        }
      });

      countAttempt(result, {
        idempotencyKey: safeDelivery.idempotencyKey,
        channel: safeDelivery.channel,
        type: safeDelivery.type,
        status: channelResult.status,
        sentAt: channelResult.sentAt,
        errorMessage: channelResult.errorMessage
      });
    }

    return result;
  }
}

export function createConfiguredAlertDeliveryAdapter(prisma: PrismaClient): AlertDeliveryAdapter {
  return new PrismaAlertDeliveryAdapter(prisma);
}
