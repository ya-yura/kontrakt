import React, { type ComponentProps } from "react";
import { aiAnalysisResponseSchema, type AIAnalysisResponse } from "@/src/eis223/client";

type FormAction = NonNullable<ComponentProps<"form">["action"]>;

export type AIPanelDocument = {
  id: string;
  title: string;
  fileName: string | null;
  status: string;
  extractionStatus: string;
  textChecksum: string | null;
};

export type AIPanelAnalysis = {
  id: string;
  status: string;
  summary: string | null;
  score: number | null;
  result: unknown;
  errorMessage: string | null;
  inputHash: string;
  promptVersion: string;
  provider: string | null;
  model: string | null;
  updatedAt: Date | string;
  completedAt: Date | string | null;
};

type AnalysisPanelStatus =
  | "NO_ANALYSIS"
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "OCR_REQUIRED"
  | "TEXT_NOT_READY";

type AnalyzedDocuments = {
  ids: Set<string>;
  source: "source-spans" | "processor-result" | "none";
};

export type AIAnalysisPanelProps = {
  tenderId: string;
  documents: AIPanelDocument[];
  latestAnalysis: AIPanelAnalysis | null;
  requestAction: FormAction;
  formatDate: (value: Date | string | null | undefined) => string;
};

const panelStatusLabels: Record<AnalysisPanelStatus, string> = {
  NO_ANALYSIS: "No analysis",
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  OCR_REQUIRED: "OCR_REQUIRED",
  TEXT_NOT_READY: "Text not ready"
};

const documentExtractionStatusLabels: Record<string, string> = {
  PENDING: "Text pending",
  DOWNLOADED: "Downloaded",
  TEXT_READY: "Text ready",
  OCR_REQUIRED: "OCR_REQUIRED",
  FAILED: "FAILED"
};

function activeDocuments(documents: AIPanelDocument[]) {
  return documents.filter((document) => document.status !== "MISSING");
}

function isTextReady(document: AIPanelDocument) {
  return document.extractionStatus === "TEXT_READY" && Boolean(document.textChecksum?.trim());
}

function documentDisplayName(document: AIPanelDocument) {
  return document.fileName ?? document.title;
}

function listNames(documents: AIPanelDocument[]) {
  return documents.map((document) => documentDisplayName(document)).join(", ");
}

function deriveReadiness(documents: AIPanelDocument[]) {
  const active = activeDocuments(documents);
  const ready = active.filter(isTextReady);
  const ocrRequired = active.filter((document) => document.extractionStatus === "OCR_REQUIRED");
  const failed = active.filter((document) => document.extractionStatus === "FAILED");
  const textNotReady = active.filter(
    (document) =>
      !isTextReady(document) &&
      document.extractionStatus !== "OCR_REQUIRED" &&
      document.extractionStatus !== "FAILED"
  );

  let disabledReason: string | null = null;

  if (active.length === 0) {
    disabledReason = "No available documents with extracted text.";
  } else if (ocrRequired.length > 0) {
    disabledReason = `OCR required before AI analysis: ${listNames(ocrRequired)}.`;
  } else if (failed.length > 0) {
    disabledReason = `Text extraction failed before AI analysis: ${listNames(failed)}.`;
  } else if (textNotReady.length > 0) {
    disabledReason = `Document text is not ready: ${listNames(textNotReady)}.`;
  }

  return {
    active,
    ready,
    ocrRequired,
    failed,
    textNotReady,
    canRequest: disabledReason === null,
    disabledReason
  };
}

function derivePanelStatus(
  latestAnalysis: AIPanelAnalysis | null,
  readiness: ReturnType<typeof deriveReadiness>
): AnalysisPanelStatus {
  if (latestAnalysis) {
    if (latestAnalysis.status === "PENDING") {
      return "PENDING";
    }

    if (latestAnalysis.status === "RUNNING") {
      return "RUNNING";
    }

    if (latestAnalysis.status === "COMPLETED") {
      return "COMPLETED";
    }

    if (latestAnalysis.status === "FAILED") {
      return "FAILED";
    }
  }

  if (readiness.ocrRequired.length > 0) {
    return "OCR_REQUIRED";
  }

  if (readiness.failed.length > 0 || readiness.textNotReady.length > 0) {
    return "TEXT_NOT_READY";
  }

  return "NO_ANALYSIS";
}

function getOutputPayload(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }

  const record = result as Record<string, unknown>;

  return "output" in record ? record.output : result;
}

export function parseSourceBackedAIResult(result: unknown): AIAnalysisResponse | null {
  const parsed = aiAnalysisResponseSchema.safeParse(getOutputPayload(result));

  return parsed.success ? parsed.data : null;
}

function collectFactSpans(result: AIAnalysisResponse) {
  return [
    ...result.summaryItems.flatMap((item) => item.sourceSpans),
    ...result.requirements.flatMap((item) => item.sourceSpans),
    ...result.risks.flatMap((item) => item.sourceSpans),
    ...result.deadlines.flatMap((item) => item.sourceSpans),
    ...result.requestedDocuments.flatMap((item) => item.sourceSpans),
    ...result.evaluationCriteria.flatMap((item) => item.sourceSpans),
    ...result.citations
  ];
}

function collectProcessorDocumentIds(result: unknown) {
  const output = getOutputPayload(result);

  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return new Set<string>();
  }

  const documents = (output as Record<string, unknown>).documents;

  if (!Array.isArray(documents)) {
    return new Set<string>();
  }

  return new Set(
    documents.flatMap((document) => {
      if (!document || typeof document !== "object" || Array.isArray(document)) {
        return [];
      }

      const id = (document as Record<string, unknown>).id;

      return typeof id === "string" && id.trim() ? [id] : [];
    })
  );
}

function getAnalyzedDocuments(
  latestAnalysis: AIPanelAnalysis | null,
  structuredResult: AIAnalysisResponse | null
): AnalyzedDocuments {
  if (!latestAnalysis || latestAnalysis.status !== "COMPLETED") {
    return {
      ids: new Set(),
      source: "none"
    };
  }

  if (structuredResult) {
    return {
      ids: new Set(collectFactSpans(structuredResult).map((span) => span.documentId)),
      source: "source-spans"
    };
  }

  const processorIds = collectProcessorDocumentIds(latestAnalysis.result);

  return {
    ids: processorIds,
    source: processorIds.size > 0 ? "processor-result" : "none"
  };
}

function formatConfidence(value: number | null | undefined) {
  return value == null ? "confidence unknown" : `${value}% confidence`;
}

function spanKey(span: AIAnalysisResponse["citations"][number], index: number) {
  return `${span.documentId}-${span.start}-${span.end}-${index}`;
}

function statusMeta(status: AnalysisPanelStatus) {
  if (status === "COMPLETED") {
    return "Source-backed fields below are derived from document spans.";
  }

  if (status === "OCR_REQUIRED") {
    return "AI analysis is blocked until scanned documents pass OCR.";
  }

  if (status === "TEXT_NOT_READY") {
    return "AI analysis is blocked until document text is ready.";
  }

  if (status === "FAILED") {
    return "The latest AI run failed safely; no fallback summary is treated as fact.";
  }

  if (status === "PENDING" || status === "RUNNING") {
    return "The request has been accepted; refresh after the analysis runner completes.";
  }

  return "Run AI only after the document text is ready.";
}

export function AIAnalysisPanel({
  tenderId,
  documents,
  latestAnalysis,
  requestAction,
  formatDate
}: AIAnalysisPanelProps) {
  const readiness = deriveReadiness(documents);
  const panelStatus = derivePanelStatus(latestAnalysis, readiness);
  const structuredResult = parseSourceBackedAIResult(latestAnalysis?.result);
  const analyzedDocuments = getAnalyzedDocuments(latestAnalysis, structuredResult);
  const isBusy = panelStatus === "PENDING" || panelStatus === "RUNNING";
  const requestDisabledReason = isBusy
    ? "AI analysis is already pending or running."
    : readiness.disabledReason;
  const hasLatestAnalysis = latestAnalysis !== null;
  const refreshDisabledReason = !hasLatestAnalysis
    ? "Run the initial AI analysis before refreshing."
    : requestDisabledReason;
  const actionTitle = requestDisabledReason ?? "Request source-backed AI analysis.";
  const refreshTitle = refreshDisabledReason ?? "Request a fresh source-backed AI analysis.";
  const canShowStructuredFields = latestAnalysis?.status === "COMPLETED" && structuredResult;
  const canShowFallbackSummary =
    latestAnalysis?.status === "COMPLETED" && !structuredResult && Boolean(latestAnalysis.summary);

  return (
    <section className="tender-section ai-analysis-panel" aria-labelledby="ai-analysis-heading">
      <div className="section-heading split-heading">
        <div>
          <p className="section-kicker">AI extractive panel</p>
          <h2 id="ai-analysis-heading">AI-анализ</h2>
        </div>
        <span className="badge badge-source">{panelStatusLabels[panelStatus]}</span>
      </div>

      <p className="ai-review-note">
        AI output is extractive and still needs human review. {statusMeta(panelStatus)}
      </p>

      <div className="ai-action-row" aria-label={`AI actions for tender ${tenderId}`}>
        <form action={requestAction}>
          <button
            className="secondary-button"
            disabled={Boolean(requestDisabledReason)}
            title={actionTitle}
            type="submit"
          >
            Request AI analysis
          </button>
        </form>
        <form action={requestAction}>
          <button
            className="secondary-button"
            disabled={Boolean(refreshDisabledReason)}
            title={refreshTitle}
            type="submit"
          >
            Refresh AI analysis
          </button>
        </form>
      </div>

      <DocumentReadinessList
        analyzedDocuments={analyzedDocuments}
        documents={documents}
        readyCount={readiness.ready.length}
      />

      {latestAnalysis ? (
        <dl className="ai-meta-grid">
          <div>
            <dt>promptVersion</dt>
            <dd>{latestAnalysis.promptVersion}</dd>
          </div>
          <div>
            <dt>inputHash</dt>
            <dd>{latestAnalysis.inputHash.slice(0, 12)}</dd>
          </div>
          <div>
            <dt>provider/model</dt>
            <dd>{[latestAnalysis.provider, latestAnalysis.model].filter(Boolean).join(" / ") || "not set"}</dd>
          </div>
          <div>
            <dt>updatedAt</dt>
            <dd>{formatDate(latestAnalysis.updatedAt)}</dd>
          </div>
        </dl>
      ) : null}

      {latestAnalysis?.status === "FAILED" ? (
        <p className="alert-error">
          {latestAnalysis.errorMessage ?? "AI analysis failed safely."}
        </p>
      ) : null}

      {canShowStructuredFields ? (
        <div className="ai-result-grid">
          <section className="ai-result-block ai-result-block-wide" aria-labelledby="ai-summary-heading">
            <div className="ai-result-heading">
              <h3 id="ai-summary-heading">summaryMd</h3>
              <span>{formatConfidence(structuredResult.confidence)}</span>
            </div>
            <SummaryMarkdown summaryMd={structuredResult.summaryMd} />
          </section>

          <FactList title="Required documents" facts={structuredResult.requestedDocuments} />
          <FactList title="Critical risks" facts={structuredResult.risks} emptyLabel="No source-backed critical risks extracted." />
          <FactList title="Deadlines" facts={structuredResult.deadlines} />
          <FactList title="Evaluation criteria" facts={structuredResult.evaluationCriteria} />
          <UnknownsList unknowns={structuredResult.unknowns} />
          <CitationsList citations={structuredResult.citations} />
        </div>
      ) : null}

      {canShowFallbackSummary ? (
        <div className="ai-unverified-summary">
          <h3>Processor summary without source spans</h3>
          <p>{latestAnalysis.summary}</p>
          <small>
            This completed run did not include a valid source-span result, so the summary is not shown
            as authoritative extractive analysis.
          </small>
        </div>
      ) : null}

      {latestAnalysis?.status === "COMPLETED" && !structuredResult ? (
        <p className="form-alert">
          Structured AI result is unavailable or failed source-span validation. Facts without
          source_spans are withheld from the authoritative panel.
        </p>
      ) : null}
    </section>
  );
}

function DocumentReadinessList({
  documents,
  analyzedDocuments,
  readyCount
}: {
  documents: AIPanelDocument[];
  analyzedDocuments: AnalyzedDocuments;
  readyCount: number;
}) {
  return (
    <div className="ai-documents-block">
      <div className="ai-result-heading">
        <h3>Documents checked by AI</h3>
        <span>{readyCount} text-ready</span>
      </div>
      {documents.length === 0 ? (
        <p className="ai-muted-text">No document metadata is attached to this tender.</p>
      ) : (
        <ul className="ai-document-list">
          {documents.map((document) => {
            const analyzed = analyzedDocuments.ids.has(document.id);
            const label = analyzed
              ? analyzedDocuments.source === "source-spans"
                ? "Analyzed with citations"
                : "Processor-reported analyzed"
              : isTextReady(document)
                ? "Text ready, not cited"
                : document.extractionStatus;

            return (
              <li key={document.id}>
                <div>
                  <strong>{documentDisplayName(document)}</strong>
                  <small>{document.title}</small>
                </div>
                <span className="badge badge-document">
                  {documentExtractionStatusLabels[document.extractionStatus] ??
                    document.extractionStatus}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
      {analyzedDocuments.source === "none" ? (
        <p className="ai-muted-text">
          No analyzed document list can be verified from the latest AI result.
        </p>
      ) : null}
    </div>
  );
}

function SummaryMarkdown({ summaryMd }: { summaryMd: string | null }) {
  if (!summaryMd) {
    return <p className="ai-muted-text">No source-backed summary items were extracted.</p>;
  }

  const items = summaryMd
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line));

  return (
    <ul className="ai-fact-list">
      {items.map((item) => (
        <li key={item}>
          <p>{item}</p>
        </li>
      ))}
    </ul>
  );
}

function FactList({
  title,
  facts,
  emptyLabel = "No source-backed items extracted."
}: {
  title: string;
  facts: AIAnalysisResponse["requirements"];
  emptyLabel?: string;
}) {
  return (
    <section className="ai-result-block" aria-label={title}>
      <div className="ai-result-heading">
        <h3>{title}</h3>
        <span>{facts.length} cited</span>
      </div>
      {facts.length === 0 ? (
        <p className="ai-muted-text">{emptyLabel}</p>
      ) : (
        <ul className="ai-fact-list">
          {facts.map((fact) => (
            <li key={`${title}-${fact.label}-${fact.text}`}>
              <strong>{fact.label}</strong>
              <p>{fact.text}</p>
              {fact.value ? <small>value: {fact.value}</small> : null}
              <small>{formatConfidence(fact.confidence)}</small>
              <SourceSpanList spans={fact.sourceSpans} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UnknownsList({ unknowns }: { unknowns: AIAnalysisResponse["unknowns"] }) {
  return (
    <section className="ai-result-block" aria-label="Unknowns">
      <div className="ai-result-heading">
        <h3>Unknowns</h3>
        <span>{unknowns.length} open</span>
      </div>
      {unknowns.length === 0 ? (
        <p className="ai-muted-text">No source-backed unknowns reported.</p>
      ) : (
        <ul className="ai-fact-list">
          {unknowns.map((unknown) => (
            <li key={`${unknown.field}-${unknown.reason}`}>
              <strong>{unknown.field}</strong>
              <p>{unknown.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CitationsList({ citations }: { citations: AIAnalysisResponse["citations"] }) {
  return (
    <section className="ai-result-block ai-result-block-wide" aria-label="Citations and source spans">
      <div className="ai-result-heading">
        <h3>Citations / source spans</h3>
        <span>{citations.length} spans</span>
      </div>
      {citations.length === 0 ? (
        <p className="ai-muted-text">No citations were returned.</p>
      ) : (
        <SourceSpanList spans={citations} />
      )}
    </section>
  );
}

function SourceSpanList({ spans }: { spans: AIAnalysisResponse["citations"] }) {
  return (
    <ul className="ai-source-span-list">
      {spans.map((span, index) => (
        <li key={spanKey(span, index)}>
          <strong>{span.documentTitle ?? span.documentId}</strong>
          <span>
            {span.start}-{span.end}
          </span>
          <q>{span.quote}</q>
        </li>
      ))}
    </ul>
  );
}
