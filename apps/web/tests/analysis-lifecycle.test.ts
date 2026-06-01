import test from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { POST as postAnalysisRun } from "../app/api/cron/analysis/run/route";
import {
  requestTenderAnalysisForUser,
  type AnalysisRequestStore,
  type CreateAnalysisInput,
  type DocumentAnalysisOwnerRecord,
  type ExistingAnalysisRecord,
  type TenderAnalysisOwnerRecord
} from "../src/analysis/request-analysis";
import {
  createFastApiAnalysisProcessor,
  runAnalysis,
  type AnalysisForRun,
  type AnalysisRunPrisma,
  type AnalysisRunSummary
} from "../src/analysis/run-analysis";
import type {
  AIAnalysisClient,
  AIAnalysisResponse,
  AISummarizeTenderRequest
} from "../src/eis223/client";

type StoredRunAnalysis = AnalysisForRun & {
  provider: string | null;
  model: string | null;
  summary: string | null;
  score: number | null;
  result: unknown;
  error: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

class AnalysisRequestStoreFake implements AnalysisRequestStore {
  readonly analyses: ExistingAnalysisRecord[] = [];
  createCount = 0;

  constructor(
    private readonly tender: TenderAnalysisOwnerRecord,
    private readonly document: DocumentAnalysisOwnerRecord | null = null
  ) {}

  async findOwnedTenderForAnalysis(tenderId: string, userId: string) {
    if (this.tender.id !== tenderId || this.tender.ownerId !== userId) {
      return null;
    }

    return this.tender;
  }

  async findOwnedDocumentForAnalysis(documentId: string, userId: string) {
    if (!this.document || this.document.id !== documentId || this.document.tender.ownerId !== userId) {
      return null;
    }

    return this.document;
  }

  async findAnalysisByIdentity(input: {
    targetKey: string;
    kind: ExistingAnalysisRecord["kind"];
    inputHash: string;
    promptVersion: string;
  }) {
    return (
      this.analyses.find(
        (analysis) =>
          analysis.targetKey === input.targetKey &&
          analysis.kind === input.kind &&
          analysis.inputHash === input.inputHash &&
          analysis.promptVersion === input.promptVersion
      ) ?? null
    );
  }

  async createAnalysis(input: CreateAnalysisInput) {
    this.createCount += 1;
    const analysis: ExistingAnalysisRecord = {
      id: `analysis-${this.createCount}`,
      tenderId: input.tenderId,
      documentId: input.documentId,
      kind: input.kind,
      targetKey: input.targetKey,
      inputHash: input.inputHash,
      promptVersion: input.promptVersion,
      status: "PENDING"
    };
    this.analyses.push(analysis);
    return analysis;
  }
}

class AnalysisRunPrismaFake implements AnalysisRunPrisma {
  readonly analyses = new Map<string, StoredRunAnalysis>();
  readonly transitions: Array<{ id: string; status: string }> = [];

  readonly aiAnalysis = {
    findMany: async (rawArgs: unknown) => {
      const args = rawArgs as { take?: number };

      return [...this.analyses.values()]
        .filter((analysis) => analysis.status === "PENDING")
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .slice(0, args.take ?? 10);
    },
    updateMany: async (rawArgs: unknown) => {
      const args = rawArgs as {
        where: { id: string; status?: string };
        data: Partial<StoredRunAnalysis>;
      };
      const analysis = this.analyses.get(args.where.id);

      if (!analysis || (args.where.status && analysis.status !== args.where.status)) {
        return { count: 0 };
      }

      Object.assign(analysis, args.data);
      if (typeof args.data.status === "string") {
        this.transitions.push({ id: analysis.id, status: args.data.status });
      }

      return { count: 1 };
    },
    update: async (rawArgs: unknown) => {
      const args = rawArgs as { where: { id: string }; data: Partial<StoredRunAnalysis> };
      const analysis = this.analyses.get(args.where.id);

      if (!analysis) {
        throw new Error(`Missing analysis ${args.where.id}`);
      }

      Object.assign(analysis, args.data);
      if (typeof args.data.status === "string") {
        this.transitions.push({ id: analysis.id, status: args.data.status });
      }

      return analysis;
    }
  };

  readonly runtimeLock = {
    deleteMany: async () => ({}),
    updateMany: async () => ({ count: 1 })
  };

  async $queryRaw<T>(_query: TemplateStringsArray, ..._values: unknown[]): Promise<T> {
    return [{ name: "analysis.run", ownerToken: "owner-token" }] as T;
  }

  add(overrides: Partial<StoredRunAnalysis> = {}) {
    const id = overrides.id ?? `analysis-${this.analyses.size + 1}`;
    const analysis: StoredRunAnalysis = {
      id,
      tenderId: "tender-1",
      documentId: null,
      kind: "TENDER_SUMMARY",
      targetKey: "tender:tender-1",
      inputHash: "a".repeat(64),
      promptVersion: "summary-v1",
      status: "PENDING",
      provider: null,
      model: null,
      summary: null,
      score: null,
      result: null,
      error: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-05-31T08:00:00.000Z"),
      tender: {
        id: "tender-1",
        registryNumber: "32413500001",
        title: "Dental consumables",
        customerName: "AO Customer",
        payloadHash: "payload-1",
        documents: [
          {
            id: "doc-1",
            title: "Documentation",
            type: "PROCUREMENT_DOCUMENTATION",
            status: "AVAILABLE",
            extractionStatus: "TEXT_READY",
            textContent: "Tender document text",
            textChecksum: "b".repeat(64)
          }
        ]
      },
      document: null,
      ...overrides
    };
    this.analyses.set(id, analysis);
    return analysis;
  }
}

function readyTender(overrides: Partial<TenderAnalysisOwnerRecord> = {}): TenderAnalysisOwnerRecord {
  return {
    id: "tender-1",
    ownerId: "user-1",
    payloadHash: "payload-1",
    documents: [
      {
        id: "doc-1",
        title: "Documentation",
        status: "AVAILABLE",
        extractionStatus: "TEXT_READY",
        textContent: "Tender text",
        textChecksum: "b".repeat(64)
      }
    ],
    ...overrides
  };
}

async function withConsoleSilenced(run: () => Promise<AnalysisRunSummary>) {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = () => {};
  console.warn = () => {};

  try {
    return await run();
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
}

function restoreEnvValue(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function fakeAIResponse(documentId: string, quote: string): AIAnalysisResponse {
  return {
    provider: "mock",
    model: "mock-extractive-223fz-v1",
    promptVersion: "summary-v1",
    language: "ru",
    summaryMd: `- ${quote}`,
    summaryItems: [
      {
        text: quote,
        sourceSpans: [
          {
            documentId,
            documentTitle: "Documentation",
            chunkId: null,
            start: 0,
            end: quote.length,
            quote
          }
        ]
      }
    ],
    requirements: [
      {
        label: "Требование",
        text: quote,
        value: null,
        sourceSpans: [
          {
            documentId,
            documentTitle: "Documentation",
            chunkId: null,
            start: 0,
            end: quote.length,
            quote
          }
        ],
        confidence: 82
      }
    ],
    risks: [],
    deadlines: [],
    requestedDocuments: [],
    evaluationCriteria: [],
    fieldsExtracted: {
      summaryMd: true,
      requirements: true,
      risks: false,
      deadlines: false,
      requestedDocuments: false,
      evaluationCriteria: false
    },
    citations: [
      {
        documentId,
        documentTitle: "Documentation",
        chunkId: null,
        start: 0,
        end: quote.length,
        quote
      }
    ],
    confidence: 74,
    unknowns: [
      {
        field: "deadlines",
        reason: "В исходном тексте не найдены сроки с подтверждающими source spans."
      }
    ]
  };
}

test("requestTenderAnalysisForUser creates a pending tender summary analysis", async () => {
  const store = new AnalysisRequestStoreFake(readyTender());
  const result = await requestTenderAnalysisForUser(store, "user-1", "tender-1");

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected analysis request to succeed.");
  }

  assert.equal(store.createCount, 1);
  assert.equal(result.data.analysisId, "analysis-1");
  assert.equal(result.data.kind, "TENDER_SUMMARY");
  assert.equal(result.data.targetKey, "tender:tender-1");
  assert.equal(result.data.status, "PENDING");
  assert.equal(result.data.reused, false);
  assert.equal(result.data.inputHash.length, 64);
});

test("requestTenderAnalysisForUser reuses duplicate kind/inputHash/promptVersion", async () => {
  const store = new AnalysisRequestStoreFake(readyTender());
  const first = await requestTenderAnalysisForUser(store, "user-1", "tender-1");
  const second = await requestTenderAnalysisForUser(store, "user-1", "tender-1");

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) {
    assert.fail("Expected duplicate analysis request to succeed.");
  }

  assert.equal(store.createCount, 1);
  assert.equal(second.data.analysisId, first.data.analysisId);
  assert.equal(second.data.inputHash, first.data.inputHash);
  assert.equal(second.data.reused, true);
});

test("requestTenderAnalysisForUser rejects tenders owned by another user", async () => {
  const store = new AnalysisRequestStoreFake(readyTender({ ownerId: "user-2" }));
  const result = await requestTenderAnalysisForUser(store, "user-1", "tender-1");

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected ownership check to fail.");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.createCount, 0);
});

test("analysis cron marks pending analysis running and completed", async () => {
  const prisma = new AnalysisRunPrismaFake();
  const analysis = prisma.add();

  const summary = await withConsoleSilenced(() =>
    runAnalysis({
      prisma,
      useLock: false,
      processor: {
        async analyze() {
          return {
            summary: "Validated mock summary.",
            score: 42,
            result: {
              signal: "ok"
            }
          };
        }
      }
    })
  );

  assert.deepEqual(summary, {
    analysesScanned: 1,
    markedRunning: 1,
    completed: 1,
    failed: 0,
    skipped: 0,
    errorsCount: 0
  });
  assert.deepEqual(
    prisma.transitions.map((transition) => transition.status),
    ["RUNNING", "COMPLETED"]
  );
  assert.equal(analysis.status, "COMPLETED");
  assert.equal(analysis.summary, "Validated mock summary.");
  assert.equal(analysis.score, 42);
  assert.ok(analysis.startedAt instanceof Date);
  assert.ok(analysis.completedAt instanceof Date);
});

test("analysis cron can consume FastAPI extractive response", async () => {
  const prisma = new AnalysisRunPrismaFake();
  const analysis = prisma.add();
  const calls: AISummarizeTenderRequest[] = [];
  const client: AIAnalysisClient = {
    async summarizeTender(request) {
      calls.push(request);
      return fakeAIResponse(request.documents[0].documentId, request.documents[0].text ?? "");
    },
    async summarizeDocument() {
      throw new Error("Unexpected document summary call.");
    },
    async diffDocument() {
      throw new Error("Unexpected diff call.");
    }
  };

  const summary = await withConsoleSilenced(() =>
    runAnalysis({
      prisma,
      useLock: false,
      processor: createFastApiAnalysisProcessor(client)
    })
  );

  assert.equal(summary.completed, 1);
  assert.equal(analysis.status, "COMPLETED");
  assert.equal(analysis.provider, "fastapi-mock");
  assert.equal(analysis.model, "mock-extractive-223fz-v1");
  assert.equal(analysis.score, 74);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenderId, "tender-1");
  assert.equal(calls[0].documents.length, 1);
  assert.equal(calls[0].documents[0].text, "Tender document text");
  assert.equal("ownerComment" in calls[0], false);
  assert.equal("payloadHash" in calls[0], false);
});

test("analysis cron does not complete unsupported FastAPI summaryMd", async () => {
  const prisma = new AnalysisRunPrismaFake();
  const analysis = prisma.add({ id: "analysis-unsupported-summary", inputHash: "e".repeat(64) });
  const client: AIAnalysisClient = {
    async summarizeTender(request) {
      return {
        ...fakeAIResponse(request.documents[0].documentId, request.documents[0].text ?? ""),
        summaryMd: "- Unsupported provider-generated summary.",
        summaryItems: []
      };
    },
    async summarizeDocument() {
      throw new Error("Unexpected document summary call.");
    },
    async diffDocument() {
      throw new Error("Unexpected diff call.");
    }
  };

  const summary = await withConsoleSilenced(() =>
    runAnalysis({
      prisma,
      useLock: false,
      processor: createFastApiAnalysisProcessor(client)
    })
  );

  assert.equal(summary.completed, 0);
  assert.equal(summary.failed, 1);
  assert.equal(analysis.status, "FAILED");
  assert.equal(analysis.summary, null);
  assert.equal(analysis.errorMessage, "AI processor response failed validation.");
});

test("analysis cron marks invalid JSON and invalid schema responses failed safely", async () => {
  const prisma = new AnalysisRunPrismaFake();
  const invalidJson = prisma.add({ id: "analysis-invalid-json", inputHash: "c".repeat(64) });
  const invalidSchema = prisma.add({
    id: "analysis-invalid-schema",
    inputHash: "d".repeat(64),
    createdAt: new Date("2026-05-31T08:01:00.000Z")
  });

  const summary = await withConsoleSilenced(() =>
    runAnalysis({
      prisma,
      useLock: false,
      processor: {
        async analyze(analysis) {
          if (analysis.id === invalidJson.id) {
            return "{not-json";
          }

          return {
            summary: ""
          };
        }
      }
    })
  );

  assert.equal(summary.failed, 2);
  assert.equal(summary.errorsCount, 2);
  assert.equal(invalidJson.status, "FAILED");
  assert.equal(invalidJson.errorMessage, "AI processor returned invalid JSON.");
  assert.equal(invalidSchema.status, "FAILED");
  assert.equal(invalidSchema.errorMessage, "AI processor response failed validation.");
  assert.equal(JSON.stringify(invalidJson).includes("{not-json"), false);
});

test("analysis cron route rejects unauthorized requests with a safe summary", async () => {
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-secret";

  try {
    const missingResponse = await postAnalysisRun(new Request("http://localhost/api/cron/analysis/run", {
      method: "POST"
    }) as unknown as NextRequest);
    const wrongResponse = await postAnalysisRun(new Request("http://localhost/api/cron/analysis/run", {
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
    assert.equal(wrongBody.analysesScanned, 0);
    assert.equal(serialized.includes("correct-secret"), false);
    assert.equal(serialized.includes("leaked-secret"), false);
    assert.equal(serialized.includes("payload"), false);
  } finally {
    restoreEnvValue("CRON_SECRET", originalSecret);
  }
});
