import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AIAnalysisPanel,
  type AIPanelAnalysis,
  type AIPanelDocument
} from "../src/tenders/ai-analysis-panel";
import type { AIAnalysisResponse } from "../src/eis223/client";

const formatDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : "not set";

function renderPanel(input: {
  documents: AIPanelDocument[];
  latestAnalysis: AIPanelAnalysis | null;
}) {
  return renderToStaticMarkup(
    React.createElement(AIAnalysisPanel, {
      tenderId: "tender-1",
      documents: input.documents,
      latestAnalysis: input.latestAnalysis,
      requestAction: "/request-analysis",
      formatDate
    })
  );
}

function document(overrides: Partial<AIPanelDocument> = {}): AIPanelDocument {
  return {
    id: "doc-1",
    title: "Закупочная документация",
    fileName: "documentation.pdf",
    status: "AVAILABLE",
    extractionStatus: "TEXT_READY",
    textChecksum: "a".repeat(64),
    ...overrides
  };
}

function sourceBackedResponse(): AIAnalysisResponse {
  const span = {
    documentId: "doc-1",
    documentTitle: "Закупочная документация",
    chunkId: null,
    start: 10,
    end: 42,
    quote: "Поставка должна быть выполнена до 20 июня."
  };

  return {
    provider: "mock",
    model: "mock-extractive-223fz-v1",
    promptVersion: "summary-v1",
    language: "ru",
    summaryMd: "- Поставка должна быть выполнена до 20 июня.",
    summaryItems: [
      {
        text: "Поставка должна быть выполнена до 20 июня.",
        sourceSpans: [span]
      }
    ],
    requirements: [],
    risks: [
      {
        label: "Сжатый срок",
        text: "Поставка должна быть выполнена до 20 июня.",
        value: null,
        sourceSpans: [span],
        confidence: 87
      }
    ],
    deadlines: [
      {
        label: "Срок поставки",
        text: "Поставка должна быть выполнена до 20 июня.",
        value: "2026-06-20",
        deadlineType: "delivery",
        sourceSpans: [span],
        confidence: 90
      }
    ],
    requestedDocuments: [
      {
        label: "Коммерческое предложение",
        text: "Коммерческое предложение должно быть приложено к заявке.",
        value: null,
        sourceSpans: [
          {
            ...span,
            start: 50,
            end: 110,
            quote: "Коммерческое предложение должно быть приложено к заявке."
          }
        ],
        confidence: 82
      }
    ],
    evaluationCriteria: [
      {
        label: "Цена",
        text: "Оценка заявок проводится по цене договора.",
        value: null,
        sourceSpans: [
          {
            ...span,
            start: 120,
            end: 166,
            quote: "Оценка заявок проводится по цене договора."
          }
        ],
        confidence: 78
      }
    ],
    fieldsExtracted: {
      summaryMd: true,
      risks: true,
      deadlines: true,
      requestedDocuments: true,
      evaluationCriteria: true
    },
    citations: [span],
    confidence: 84,
    unknowns: [
      {
        field: "contractSecurity",
        reason: "Не найден source span с обеспечением договора."
      }
    ]
  };
}

function completedAnalysis(result: unknown, overrides: Partial<AIPanelAnalysis> = {}): AIPanelAnalysis {
  return {
    id: "analysis-1",
    status: "COMPLETED",
    summary: "- Поставка должна быть выполнена до 20 июня.",
    score: 84,
    result,
    errorMessage: null,
    inputHash: "b".repeat(64),
    promptVersion: "summary-v1",
    provider: "fastapi-mock",
    model: "mock-extractive-223fz-v1",
    updatedAt: "2026-06-01T08:00:00.000Z",
    completedAt: "2026-06-01T08:00:00.000Z",
    ...overrides
  };
}

test("AI panel renders completed source-backed analysis", () => {
  const html = renderPanel({
    documents: [
      document(),
      document({
        id: "doc-2",
        title: "Проект договора",
        fileName: "contract.pdf"
      })
    ],
    latestAnalysis: completedAnalysis({
      version: "analysis-result-v1",
      output: sourceBackedResponse()
    })
  });

  assert.match(html, /Completed/);
  assert.match(html, /summaryMd/);
  assert.match(html, /Required documents/);
  assert.match(html, /Critical risks/);
  assert.match(html, /Deadlines/);
  assert.match(html, /Evaluation criteria/);
  assert.match(html, /Unknowns/);
  assert.match(html, /84% confidence/);
  assert.match(html, /Analyzed with citations/);
  assert.match(html, /Text ready, not cited/);
  assert.match(html, /10-42/);
  assert.match(html, /Поставка должна быть выполнена до 20 июня/);
  assert.match(html, /extractive and still needs human review/);
});

test("AI panel renders OCR_REQUIRED and FAILED document states without fake summary", () => {
  const html = renderPanel({
    documents: [
      document({
        id: "doc-scan",
        title: "Скан документации",
        fileName: "scan.pdf",
        extractionStatus: "OCR_REQUIRED",
        textChecksum: null
      }),
      document({
        id: "doc-failed",
        title: "Поврежденный файл",
        fileName: "broken.pdf",
        extractionStatus: "FAILED",
        textChecksum: null
      })
    ],
    latestAnalysis: null
  });

  assert.match(html, /OCR_REQUIRED/);
  assert.match(html, /FAILED/);
  assert.match(html, /AI analysis is blocked until scanned documents pass OCR/);
  assert.match(html, /Request AI analysis/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /summaryMd/);
  assert.doesNotMatch(html, /Mock analysis completed/);
});

test("AI panel does not render facts without source_spans as authoritative", () => {
  const html = renderPanel({
    documents: [document()],
    latestAnalysis: completedAnalysis({
      provider: "mock",
      model: "bad-provider",
      promptVersion: "summary-v1",
      language: "ru",
      summaryMd: null,
      summaryItems: [],
      requirements: [],
      risks: [],
      deadlines: [],
      requestedDocuments: [
        {
          label: "Uncited document",
          text: "This unsupported fact must not become an authoritative panel item.",
          value: null,
          confidence: 99
        }
      ],
      evaluationCriteria: [],
      fieldsExtracted: {},
      citations: [],
      confidence: 99,
      unknowns: []
    }, {
      summary: null
    })
  });

  assert.match(html, /Structured AI result is unavailable or failed source-span validation/);
  assert.match(html, /source_spans are withheld/);
  assert.doesNotMatch(html, /This unsupported fact must not become an authoritative panel item/);
});
