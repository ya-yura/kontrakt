import {
  createDocumentAnalysisInputHash,
  createTenderAnalysisInputHash,
  type AnalysisKind
} from "./input-hash";
import { getPrismaClient } from "@/src/lib/prisma";

export const ANALYSIS_PROMPT_VERSION = "summary-v1";

export type AIAnalysisStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AnalysisActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_READY"
  | "UNKNOWN_ERROR";

export type AnalysisActionError = {
  code: AnalysisActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: AnalysisActionError;
    };

type AnalysisDocumentReadiness = {
  id: string;
  title: string;
  status: string;
  extractionStatus: string;
  textContent: string | null;
  textChecksum: string | null;
};

export type TenderAnalysisOwnerRecord = {
  id: string;
  ownerId: string | null;
  payloadHash: string | null;
  documents: AnalysisDocumentReadiness[];
};

export type DocumentAnalysisOwnerRecord = AnalysisDocumentReadiness & {
  tenderId: string;
  tender: {
    id: string;
    ownerId: string | null;
    payloadHash: string | null;
  };
};

export type ExistingAnalysisRecord = {
  id: string;
  tenderId: string;
  documentId: string | null;
  kind: AnalysisKind;
  targetKey: string;
  inputHash: string;
  promptVersion: string;
  status: AIAnalysisStatus;
};

export type CreateAnalysisInput = {
  tenderId: string;
  documentId: string | null;
  requestedById: string;
  kind: AnalysisKind;
  targetKey: string;
  inputHash: string;
  promptVersion: string;
};

export type AnalysisRequestStore = {
  findOwnedTenderForAnalysis(
    tenderId: string,
    userId: string
  ): Promise<TenderAnalysisOwnerRecord | null>;
  findOwnedDocumentForAnalysis(
    documentId: string,
    userId: string
  ): Promise<DocumentAnalysisOwnerRecord | null>;
  findAnalysisByIdentity(input: {
    targetKey: string;
    kind: AnalysisKind;
    inputHash: string;
    promptVersion: string;
  }): Promise<ExistingAnalysisRecord | null>;
  createAnalysis(input: CreateAnalysisInput): Promise<ExistingAnalysisRecord>;
};

type PrismaAnalysisRequestClient = {
  tender: {
    findFirst(args: unknown): Promise<TenderAnalysisOwnerRecord | null>;
  };
  document: {
    findFirst(args: unknown): Promise<DocumentAnalysisOwnerRecord | null>;
  };
  aiAnalysis: {
    findFirst(args: unknown): Promise<ExistingAnalysisRecord | null>;
    create(args: unknown): Promise<ExistingAnalysisRecord>;
  };
};

export type RequestAnalysisData = {
  analysisId: string;
  tenderId: string;
  documentId: string | null;
  kind: AnalysisKind;
  targetKey: string;
  inputHash: string;
  promptVersion: string;
  status: AIAnalysisStatus;
  reused: boolean;
};

function analysisActionFailure(
  code: AnalysisActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      fieldErrors
    }
  };
}

export function analysisUnauthorizedFailure(): ActionResult<never> {
  return analysisActionFailure("UNAUTHORIZED", "Нужно войти в систему.");
}

function analysisNotFoundFailure(): ActionResult<never> {
  return analysisActionFailure("NOT_FOUND", "Закупка или документ не найдены.");
}

function analysisNotReadyFailure(message: string, fieldErrors?: Record<string, string[]>) {
  return analysisActionFailure("NOT_READY", message, fieldErrors);
}

export function analysisUnknownFailure(message = "Не удалось запросить AI-анализ.") {
  return analysisActionFailure("UNKNOWN_ERROR", message);
}

function targetKeyForTender(tenderId: string) {
  return `tender:${tenderId}`;
}

function targetKeyForDocument(documentId: string) {
  return `document:${documentId}`;
}

function isTextReady(document: AnalysisDocumentReadiness) {
  return (
    document.status !== "MISSING" &&
    document.extractionStatus === "TEXT_READY" &&
    Boolean(document.textContent?.trim()) &&
    Boolean(document.textChecksum?.trim())
  );
}

function activeDocuments(documents: AnalysisDocumentReadiness[]) {
  return documents.filter((document) => document.status !== "MISSING");
}

function validateTenderDocumentsReady(documents: AnalysisDocumentReadiness[]) {
  const candidates = activeDocuments(documents);
  const notReady = candidates.filter((document) => !isTextReady(document));

  if (notReady.length === 0) {
    return {
      ok: true as const,
      readyDocuments: candidates.map((document) => ({
        id: document.id,
        textChecksum: document.textChecksum?.trim() ?? ""
      }))
    };
  }

  const ocrRequired = notReady.filter(
    (document) => document.extractionStatus === "OCR_REQUIRED"
  ).length;

  return {
    ok: false as const,
    error: analysisNotReadyFailure(
      "Документы еще не готовы для AI-анализа.",
      {
        documents: [
          `notReady=${notReady.length}`,
          `ocrRequired=${ocrRequired}`,
          "Запустите extraction и повторите запрос после TEXT_READY."
        ]
      }
    )
  };
}

function validateDocumentReady(document: AnalysisDocumentReadiness) {
  if (isTextReady(document)) {
    return {
      ok: true as const,
      textChecksum: document.textChecksum?.trim() ?? ""
    };
  }

  const reason =
    document.extractionStatus === "OCR_REQUIRED"
      ? "Документ требует OCR и не может считаться проанализированным."
      : "Текст документа еще не готов для AI-анализа.";

  return {
    ok: false as const,
    error: analysisNotReadyFailure(reason, {
      document: [`extractionStatus=${document.extractionStatus}`]
    })
  };
}

function toRequestAnalysisData(
  analysis: ExistingAnalysisRecord,
  reused: boolean
): RequestAnalysisData {
  return {
    analysisId: analysis.id,
    tenderId: analysis.tenderId,
    documentId: analysis.documentId,
    kind: analysis.kind,
    targetKey: analysis.targetKey,
    inputHash: analysis.inputHash,
    promptVersion: analysis.promptVersion,
    status: analysis.status,
    reused
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}

async function createOrReuseAnalysis(
  store: AnalysisRequestStore,
  input: CreateAnalysisInput
): Promise<RequestAnalysisData> {
  const existing = await store.findAnalysisByIdentity({
    targetKey: input.targetKey,
    kind: input.kind,
    inputHash: input.inputHash,
    promptVersion: input.promptVersion
  });

  if (existing) {
    return toRequestAnalysisData(existing, true);
  }

  try {
    const created = await store.createAnalysis(input);
    return toRequestAnalysisData(created, false);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const duplicate = await store.findAnalysisByIdentity({
      targetKey: input.targetKey,
      kind: input.kind,
      inputHash: input.inputHash,
      promptVersion: input.promptVersion
    });

    if (!duplicate) {
      throw error;
    }

    return toRequestAnalysisData(duplicate, true);
  }
}

export async function requestTenderAnalysisForUser(
  store: AnalysisRequestStore,
  userId: string,
  tenderId: string
): Promise<ActionResult<RequestAnalysisData>> {
  const normalizedTenderId = tenderId.trim();

  if (!normalizedTenderId) {
    return analysisActionFailure("VALIDATION_ERROR", "Tender id is required.", {
      tenderId: ["Tender id is required."]
    });
  }

  const tender = await store.findOwnedTenderForAnalysis(normalizedTenderId, userId);

  if (!tender) {
    return analysisNotFoundFailure();
  }

  const readiness = validateTenderDocumentsReady(tender.documents);

  if (!readiness.ok) {
    return readiness.error;
  }

  const inputHash = createTenderAnalysisInputHash({
    tenderId: tender.id,
    tenderPayloadHash: tender.payloadHash,
    includedDocuments: readiness.readyDocuments
  });
  const targetKey = targetKeyForTender(tender.id);
  const data = await createOrReuseAnalysis(store, {
    tenderId: tender.id,
    documentId: null,
    requestedById: userId,
    kind: "TENDER_SUMMARY",
    targetKey,
    inputHash,
    promptVersion: ANALYSIS_PROMPT_VERSION
  });

  return {
    ok: true,
    data
  };
}

export async function requestDocumentAnalysisForUser(
  store: AnalysisRequestStore,
  userId: string,
  documentId: string
): Promise<ActionResult<RequestAnalysisData>> {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId) {
    return analysisActionFailure("VALIDATION_ERROR", "Document id is required.", {
      documentId: ["Document id is required."]
    });
  }

  const document = await store.findOwnedDocumentForAnalysis(normalizedDocumentId, userId);

  if (!document) {
    return analysisNotFoundFailure();
  }

  const readiness = validateDocumentReady(document);

  if (!readiness.ok) {
    return readiness.error;
  }

  const inputHash = createDocumentAnalysisInputHash({
    tenderId: document.tender.id,
    documentId: document.id,
    tenderPayloadHash: document.tender.payloadHash,
    documentTextChecksum: readiness.textChecksum
  });
  const targetKey = targetKeyForDocument(document.id);
  const data = await createOrReuseAnalysis(store, {
    tenderId: document.tender.id,
    documentId: document.id,
    requestedById: userId,
    kind: "DOCUMENT_SUMMARY",
    targetKey,
    inputHash,
    promptVersion: ANALYSIS_PROMPT_VERSION
  });

  return {
    ok: true,
    data
  };
}

export function createPrismaAnalysisRequestStore(): AnalysisRequestStore {
  const prisma = getPrismaClient() as unknown as PrismaAnalysisRequestClient;

  return {
    async findOwnedTenderForAnalysis(tenderId, userId) {
      return prisma.tender.findFirst({
        where: {
          id: tenderId,
          ownerId: userId
        },
        select: {
          id: true,
          ownerId: true,
          payloadHash: true,
          documents: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              status: true,
              extractionStatus: true,
              textContent: true,
              textChecksum: true
            }
          }
        }
      });
    },

    async findOwnedDocumentForAnalysis(documentId, userId) {
      return prisma.document.findFirst({
        where: {
          id: documentId,
          tender: {
            ownerId: userId
          }
        },
        select: {
          id: true,
          title: true,
          status: true,
          extractionStatus: true,
          textContent: true,
          textChecksum: true,
          tenderId: true,
          tender: {
            select: {
              id: true,
              ownerId: true,
              payloadHash: true
            }
          }
        }
      });
    },

    async findAnalysisByIdentity(input) {
      return prisma.aiAnalysis.findFirst({
        where: {
          targetKey: input.targetKey,
          kind: input.kind,
          inputHash: input.inputHash,
          promptVersion: input.promptVersion
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          tenderId: true,
          documentId: true,
          kind: true,
          targetKey: true,
          inputHash: true,
          promptVersion: true,
          status: true
        }
      });
    },

    async createAnalysis(input) {
      return prisma.aiAnalysis.create({
        data: {
          tenderId: input.tenderId,
          documentId: input.documentId,
          requestedById: input.requestedById,
          kind: input.kind,
          targetKey: input.targetKey,
          inputHash: input.inputHash,
          promptVersion: input.promptVersion,
          status: "PENDING",
          provider: null,
          model: null,
          summary: null,
          score: null,
          result: null,
          error: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null
        },
        select: {
          id: true,
          tenderId: true,
          documentId: true,
          kind: true,
          targetKey: true,
          inputHash: true,
          promptVersion: true,
          status: true
        }
      });
    }
  };
}
