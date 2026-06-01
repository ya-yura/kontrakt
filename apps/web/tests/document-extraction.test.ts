import test from "node:test";
import assert from "node:assert/strict";
import type {
  DocumentTextExtractionClient,
  DocumentTextExtractionRequest,
  DocumentTextExtractionResponse
} from "../src/eis223/client";
import {
  runDocumentTextExtraction,
  type DocumentExtractionRunSummary
} from "../src/documents/run-extraction";

type StoredDocument = {
  id: string;
  externalDocumentId: string | null;
  title: string;
  fileName: string | null;
  status: string;
  sourceUrl: string | null;
  storageKey: string | null;
  extractionStatus: "PENDING" | "DOWNLOADED" | "TEXT_READY" | "OCR_REQUIRED" | "FAILED";
  textContent: string | null;
  textChecksum: string | null;
  pageCount: number | null;
  hasTextLayer: boolean | null;
  extractionMetadata: Record<string, unknown> | null;
};

class DocumentExtractionPrismaFake {
  readonly documents = new Map<string, StoredDocument>();
  readonly requests: DocumentTextExtractionRequest[] = [];

  readonly document = {
    findMany: async (args: { where: Record<string, unknown>; take: number }) => {
      const documentId = typeof args.where.id === "string" ? args.where.id : undefined;
      const candidates = [...this.documents.values()].filter((document) => {
        if (documentId && document.id !== documentId) {
          return false;
        }

        if (document.status === "MISSING") {
          return false;
        }

        if (!["PENDING", "DOWNLOADED", "OCR_REQUIRED"].includes(document.extractionStatus)) {
          return false;
        }

        return Boolean(document.sourceUrl ?? document.storageKey);
      });

      return candidates.slice(0, args.take);
    },
    update: async (args: {
      where: { id: string };
      data: Partial<StoredDocument>;
    }) => {
      const document = this.documents.get(args.where.id);

      if (!document) {
        throw new Error("Missing fake document.");
      }

      Object.assign(document, args.data);
      return document;
    }
  };

  readonly runtimeLock = {
    deleteMany: async () => ({}),
    updateMany: async () => ({ count: 1 })
  };

  async $queryRaw<T>(_query: TemplateStringsArray, ..._values: unknown[]): Promise<T> {
    return [{ name: "documents.extract-text", ownerToken: "owner-token" }] as T;
  }

  add(
    document: Omit<
      StoredDocument,
      "textContent" | "textChecksum" | "pageCount" | "hasTextLayer" | "extractionMetadata"
    >
  ) {
    this.documents.set(document.id, {
      ...document,
      textContent: null,
      textChecksum: null,
      pageCount: null,
      hasTextLayer: null,
      extractionMetadata: null
    });
  }
}

function extractionResponse(
  status: DocumentTextExtractionResponse["status"],
  overrides: Partial<DocumentTextExtractionResponse> = {}
): DocumentTextExtractionResponse {
  return {
    status,
    text: null,
    textChecksum: null,
    pageCount: null,
    hasTextLayer: null,
    metadata: {},
    errorMessage: null,
    ...overrides
  };
}

test("document extraction run saves FastAPI text results without AI analysis", async () => {
  const prisma = new DocumentExtractionPrismaFake();
  prisma.add({
    id: "doc-text",
    externalDocumentId: "external-text",
    title: "Documentation",
    fileName: "documentation.pdf",
    status: "AVAILABLE",
    sourceUrl: "file:///tmp/documentation.pdf",
    storageKey: null,
    extractionStatus: "PENDING"
  });
  prisma.add({
    id: "doc-scan",
    externalDocumentId: "external-scan",
    title: "Scanned documentation",
    fileName: "scan.pdf",
    status: "AVAILABLE",
    sourceUrl: "file:///tmp/scan.pdf",
    storageKey: null,
    extractionStatus: "OCR_REQUIRED"
  });
  prisma.add({
    id: "doc-bad",
    externalDocumentId: "external-bad",
    title: "Unsupported",
    fileName: "unsupported.txt",
    status: "AVAILABLE",
    sourceUrl: "file:///tmp/unsupported.txt",
    storageKey: null,
    extractionStatus: "DOWNLOADED"
  });

  const client: DocumentTextExtractionClient = {
    async extractText(request) {
      prisma.requests.push(request);

      if (request.documentId === "doc-text") {
        return extractionResponse("TEXT_READY", {
          text: "Tender text",
          textChecksum: "a".repeat(64),
          pageCount: 2,
          hasTextLayer: true,
          metadata: { extractor: "test" }
        });
      }

      if (request.documentId === "doc-scan") {
        return extractionResponse("OCR_REQUIRED", {
          pageCount: 3,
          hasTextLayer: false,
          metadata: { reason: "empty_text_layer" }
        });
      }

      return extractionResponse("FAILED", {
        errorMessage: "Unsupported document type.",
        metadata: { reason: "unsupported_mime_type" }
      });
    }
  };

  const originalConsoleInfo = console.info;
  console.info = () => {};

  let summary: DocumentExtractionRunSummary | null = null;
  try {
    summary = await runDocumentTextExtraction({
      prisma,
      client,
      batchSize: 10,
      useLock: false
    });
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.deepEqual(summary, {
    documentsScanned: 3,
    textReady: 1,
    ocrRequired: 1,
    failed: 1,
    skipped: 0,
    errorsCount: 0
  });
  assert.equal(prisma.requests.length, 3);

  const textDocument = prisma.documents.get("doc-text");
  assert.equal(textDocument?.extractionStatus, "TEXT_READY");
  assert.equal(textDocument?.textContent, "Tender text");
  assert.equal(textDocument?.textChecksum, "a".repeat(64));
  assert.equal(textDocument?.pageCount, 2);
  assert.equal(textDocument?.hasTextLayer, true);

  const scannedDocument = prisma.documents.get("doc-scan");
  assert.equal(scannedDocument?.extractionStatus, "OCR_REQUIRED");
  assert.equal(scannedDocument?.textContent, null);
  assert.equal(scannedDocument?.pageCount, 3);
  assert.equal(scannedDocument?.hasTextLayer, false);

  const failedDocument = prisma.documents.get("doc-bad");
  assert.equal(failedDocument?.extractionStatus, "FAILED");
  assert.equal(failedDocument?.textContent, null);
  assert.equal(failedDocument?.extractionMetadata?.errorMessage, "Unsupported document type.");
});

test("document extraction run leaves missing or completed documents untouched", async () => {
  const prisma = new DocumentExtractionPrismaFake();
  prisma.add({
    id: "doc-missing",
    externalDocumentId: null,
    title: "Missing",
    fileName: "missing.pdf",
    status: "MISSING",
    sourceUrl: "file:///tmp/missing.pdf",
    storageKey: null,
    extractionStatus: "PENDING"
  });
  prisma.add({
    id: "doc-ready",
    externalDocumentId: null,
    title: "Ready",
    fileName: "ready.pdf",
    status: "AVAILABLE",
    sourceUrl: "file:///tmp/ready.pdf",
    storageKey: null,
    extractionStatus: "TEXT_READY"
  });

  const client: DocumentTextExtractionClient = {
    async extractText() {
      throw new Error("Unexpected FastAPI call.");
    }
  };

  const originalConsoleInfo = console.info;
  console.info = () => {};

  let summary: DocumentExtractionRunSummary | null = null;
  try {
    summary = await runDocumentTextExtraction({
      prisma,
      client,
      batchSize: 10,
      useLock: false
    });
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.equal(summary?.documentsScanned, 0);
  assert.equal(prisma.documents.get("doc-missing")?.extractionStatus, "PENDING");
  assert.equal(prisma.documents.get("doc-ready")?.extractionStatus, "TEXT_READY");
});
