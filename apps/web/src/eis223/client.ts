import { z } from "zod";
import {
  normalizedTenderDTOSchema,
  type NormalizedTenderDTO
} from "@/src/tenders/normalized-tender-dto";

const DEFAULT_TIMEOUT_SECONDS = 10;

const nullableDateStringSchema = z.string().nullable();
const nullableStringSchema = z.string().nullable();
const nullableMoneySchema = z.union([z.string(), z.number()]).nullable();

const eis223SearchHitSchema = z
  .object({
    provider: z.literal("eis223"),
    law: z.literal("223-FZ"),
    externalId: z.string().min(1),
    registryNumber: z.string().min(1),
    title: z.string().min(1),
    sourceStage: z.string().min(1),
    customerName: z.string().min(1),
    customerInn: nullableStringSchema,
    procurementMethod: nullableStringSchema,
    region: nullableStringSchema,
    okpd2Codes: z.array(z.string()),
    initialPrice: nullableMoneySchema,
    currency: z.string().min(1),
    publishDate: nullableDateStringSchema,
    applicationDeadlineAt: nullableDateStringSchema,
    detailUrl: nullableStringSchema
  })
  .strict();

const eis223SearchResponseSchema = z
  .object({
    hits: z.array(eis223SearchHitSchema),
    nextCursor: nullableStringSchema,
    providerMode: z.enum(["fixture", "live"]),
    sourceFreshness: z.unknown()
  })
  .strict();

const providerErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    provider: z.literal("eis223").optional()
  })
  .passthrough();

export type EIS223SearchHit = z.output<typeof eis223SearchHitSchema>;
export type EIS223SearchResponse = z.output<typeof eis223SearchResponseSchema>;

export type EIS223SearchRequest = {
  filterId?: string;
  searchQuery?: string | null;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  okpd2Prefixes?: string[];
  regionCodes?: string[];
  methodAllowList?: string[];
  customerInnAllowList?: string[];
  customerInnBlockList?: string[];
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  daysAhead?: number | null;
  cursor?: string | null;
  limit?: number;
};

export type EIS223NormalizeRequest = {
  lotNumber?: string | null;
  includeRawPayload?: boolean;
};

export type FastApiClientErrorCode =
  | "FASTAPI_CONFIG_MISSING"
  | "FASTAPI_TIMEOUT"
  | "FASTAPI_HTTP_ERROR"
  | "FASTAPI_INVALID_RESPONSE";

export class FastApiClientError extends Error {
  readonly code: FastApiClientErrorCode;
  readonly status?: number;
  readonly providerError?: string;

  constructor(
    code: FastApiClientErrorCode,
    message: string,
    options: { status?: number; providerError?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "FastApiClientError";
    this.code = code;
    this.status = options.status;
    this.providerError = options.providerError;
    this.cause = options.cause;
  }
}

export type EIS223Client = {
  search(request: EIS223SearchRequest): Promise<EIS223SearchResponse>;
  normalizePurchase(
    externalPurchaseId: string,
    request?: EIS223NormalizeRequest
  ): Promise<NormalizedTenderDTO>;
};

type JsonSchema<T> = {
  parse(input: unknown): T;
};

function getBaseUrl() {
  const baseUrl = process.env.FASTAPI_BASE_URL?.trim();

  if (!baseUrl) {
    throw new FastApiClientError(
      "FASTAPI_CONFIG_MISSING",
      "FASTAPI_BASE_URL is required for EIS 223-FZ client."
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function getTimeoutMs() {
  const rawSeconds =
    process.env.FASTAPI_TIMEOUT_SECONDS ??
    process.env.EIS_PROVIDER_TIMEOUT_SECONDS ??
    String(DEFAULT_TIMEOUT_SECONDS);
  const seconds = Number(rawSeconds);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_TIMEOUT_SECONDS * 1000;
  }

  return seconds * 1000;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  const internalToken = process.env.FASTAPI_INTERNAL_TOKEN?.trim();

  if (internalToken) {
    headers["X-Internal-Token"] = internalToken;
  }

  return headers;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new FastApiClientError("FASTAPI_INVALID_RESPONSE", "FastAPI returned invalid JSON.", {
      status: response.status,
      cause: error
    });
  }
}

async function postJson<T>(path: string, body: unknown, schema: JsonSchema<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await readJson(response);

    if (!response.ok) {
      const providerError = providerErrorResponseSchema.safeParse(payload);
      const message = providerError.success
        ? providerError.data.message
        : `FastAPI request failed with status ${response.status}.`;

      throw new FastApiClientError("FASTAPI_HTTP_ERROR", message, {
        status: response.status,
        providerError: providerError.success ? providerError.data.error : undefined
      });
    }

    try {
      return schema.parse(payload);
    } catch (error) {
      throw new FastApiClientError(
        "FASTAPI_INVALID_RESPONSE",
        "FastAPI response did not match the expected EIS 223-FZ schema.",
        {
          status: response.status,
          cause: error
        }
      );
    }
  } catch (error) {
    if (error instanceof FastApiClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new FastApiClientError("FASTAPI_TIMEOUT", "FastAPI request timed out.", {
        cause: error
      });
    }

    throw new FastApiClientError("FASTAPI_HTTP_ERROR", "FastAPI request failed.", {
      cause: error
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createEIS223Client(): EIS223Client {
  return {
    search(request) {
      return postJson("/v1/eis223/search", request, eis223SearchResponseSchema);
    },

    normalizePurchase(externalPurchaseId, request = {}) {
      return postJson(
        `/v1/eis223/purchase/${encodeURIComponent(externalPurchaseId)}/normalize`,
        request,
        normalizedTenderDTOSchema
      );
    }
  };
}
