import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acknowledgeAlertFromForm, requestTenderAnalysisFromForm } from "./actions";
import { TenderScoringClient, type TenderScoringView } from "./tender-scoring-client";
import { TenderWorkspaceClient } from "./tender-workspace-client";
import { requireCurrentUser } from "@/src/auth/dev-auth";
import { deriveAlertDeliveryDisplay } from "@/src/alerts/delivery-status";
import {
  buildChecklistStateForTemplate,
  parseChecklistState,
  parseChecklistTemplate
} from "@/src/board/checklist";
import { getPrismaClient } from "@/src/lib/prisma";
import { AIAnalysisPanel } from "@/src/tenders/ai-analysis-panel";
import { findTenderCardForUser } from "@/src/tenders/tender-card-query";

export const dynamic = "force-dynamic";

type TenderCardPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ChangeFeedItem = {
  at: string;
  title: string;
  description?: string;
};

const sourceStageLabels: Record<string, string> = {
  UNKNOWN: "Unknown",
  SUBMISSION_OPEN: "Submission open",
  COMMISSION_WORK: "Commission work",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  EXPIRED: "Expired"
};

const decisionLabels: Record<string, string> = {
  UNDECIDED: "Undecided",
  REVIEW: "Review",
  BID: "Bid",
  NO_BID: "No-bid"
};

const documentTypeLabels: Record<string, string> = {
  NOTICE: "Notice",
  PROCUREMENT_DOCUMENTATION: "Procurement docs",
  TECHNICAL_SPECIFICATION: "Technical spec",
  DRAFT_CONTRACT: "Draft contract",
  CLARIFICATION: "Clarification",
  PROTOCOL: "Protocol",
  OTHER: "Other"
};

const documentStatusLabels: Record<string, string> = {
  AVAILABLE: "Available",
  EXTERNAL_ONLY: "External only",
  MISSING: "Missing"
};

const documentExtractionStatusLabels: Record<string, string> = {
  PENDING: "Text pending",
  DOWNLOADED: "Downloaded",
  TEXT_READY: "Text ready",
  OCR_REQUIRED: "OCR required",
  FAILED: "Text failed"
};

const alertTypeLabels: Record<string, string> = {
  NEW_MATCH: "New match",
  DEADLINE_T48: "Deadline T-48h",
  DEADLINE_T24: "Deadline T-24h",
  DEADLINE_T2: "Deadline T-2h",
  NEW_CHANGE: "New change",
  NEW_CLARIFICATION: "New clarification",
  STAGE_SLA_BREACH: "Stage SLA breach"
};

function formatMoney(value: Prisma.Decimal | string | null | undefined, currency: string) {
  if (!value) {
    return "Не указано";
  }

  const amount = typeof value === "string" ? Number(value) : Number(value.toString());

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Не указано";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatCountdown(deadline: Date | null) {
  if (!deadline) {
    return "Дедлайн не указан";
  }

  const millisecondsLeft = deadline.getTime() - Date.now();

  if (millisecondsLeft <= 0) {
    return "Срок приема заявок прошел";
  }

  const hoursLeft = Math.ceil(millisecondsLeft / (1000 * 60 * 60));
  const days = Math.floor(hoursLeft / 24);
  const hours = hoursLeft % 24;

  if (days === 0) {
    return `Осталось ${hours} ч`;
  }

  return `Осталось ${days} д ${hours} ч`;
}

function providerModeLabel(value: string) {
  if (value === "live") {
    return "live";
  }

  return "fixture";
}

function buildInitialScoringView(tender: {
  decision: string;
  decisionReason: string | null;
  scoreTotal: number | null;
  scoreFit: number | null;
  scoreEconomics: number | null;
  scoreExecutionRisk: number | null;
  scoreComplianceRisk: number | null;
  scoreUrgency: number | null;
  scoreConfidence: number | null;
  lastScoredAt: Date | null;
}): TenderScoringView {
  return {
    decision: tender.decision as TenderScoringView["decision"],
    decisionReason: tender.decisionReason ?? "",
    scoreTotal: tender.scoreTotal,
    scoreConfidence: tender.scoreConfidence,
    lastScoredAt: tender.lastScoredAt?.toISOString() ?? null,
    breakdown: [
      { key: "fit", label: "Fit", score: tender.scoreFit, max: 30 },
      { key: "economics", label: "Economics", score: tender.scoreEconomics, max: 20 },
      { key: "execution", label: "Execution", score: tender.scoreExecutionRisk, max: 20 },
      { key: "compliance", label: "Compliance", score: tender.scoreComplianceRisk, max: 20 },
      { key: "urgency", label: "Urgency", score: tender.scoreUrgency, max: 10 }
    ]
  };
}

function toStringList(value: Prisma.JsonValue | null, fallback: string) {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const items = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");

  return items.length > 0 ? items : [fallback];
}

function toChanges(value: Prisma.JsonValue | null): ChangeFeedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const rawItem = item as Record<string, Prisma.JsonValue>;
    const at = typeof rawItem.at === "string" ? rawItem.at : null;
    const title = typeof rawItem.title === "string" ? rawItem.title : null;

    if (!at || !title) {
      return [];
    }

    return [
      {
        at,
        title,
        description: typeof rawItem.description === "string" ? rawItem.description : undefined
      }
    ];
  });
}

function getAIRequestDisabledReason(input: {
  documents: Array<{
    status: string;
    extractionStatus: string;
    fileName: string | null;
    title: string;
    textChecksum: string | null;
  }>;
  analysisIsBusy: boolean;
}) {
  if (input.analysisIsBusy) {
    return "AI analysis is already pending or running.";
  }

  const activeDocuments = input.documents.filter((document) => document.status !== "MISSING");

  if (activeDocuments.length === 0) {
    return "No available documents with extracted text.";
  }

  const ocrRequired = activeDocuments.filter(
    (document) => document.extractionStatus === "OCR_REQUIRED"
  );
  const failed = activeDocuments.filter((document) => document.extractionStatus === "FAILED");
  const textNotReady = activeDocuments.filter(
    (document) =>
      document.extractionStatus !== "TEXT_READY" ||
      !Boolean(document.textChecksum?.trim())
  );

  function names(documents: typeof activeDocuments) {
    return documents.map((document) => document.fileName ?? document.title).join(", ");
  }

  if (ocrRequired.length > 0) {
    return `OCR required before AI analysis: ${names(ocrRequired)}.`;
  }

  if (failed.length > 0) {
    return `Text extraction failed before AI analysis: ${names(failed)}.`;
  }

  if (textNotReady.length > 0) {
    return `Document text is not ready: ${names(textNotReady)}.`;
  }

  return null;
}

export default async function TenderCardPage({ params }: TenderCardPageProps) {
  const [{ id }, currentUser] = await Promise.all([params, requireCurrentUser()]);
  const tender = await findTenderCardForUser(getPrismaClient(), id, currentUser.id);

  if (!tender) {
    notFound();
  }

  const participationRequirements = toStringList(
    tender.participationRequirements,
    "Требования к участнику не нормализованы в Sprint 01 fixture."
  );
  const requiredDocuments = toStringList(
    tender.requiredDocuments,
    "Перечень документов не нормализован в Sprint 01 fixture."
  );
  const evaluationCriteria = toStringList(
    tender.evaluationCriteria,
    "Критерии оценки будут уточняться после подключения live source."
  );
  const changes = toChanges(tender.changesFeed);
  const checklistTemplate = parseChecklistTemplate(tender.kanbanStage.checklistTemplate);
  const checklistState = buildChecklistStateForTemplate(
    checklistTemplate,
    parseChecklistState(tender.checklistState)
  );
  const latestAnalysis = tender.aiAnalyses[0] ?? null;
  const analysisIsBusy =
    latestAnalysis?.status === "PENDING" || latestAnalysis?.status === "RUNNING";
  const aiRequestDisabledReason = getAIRequestDisabledReason({
    documents: tender.documents,
    analysisIsBusy
  });
  const requestAnalysisAction = requestTenderAnalysisFromForm.bind(null, tender.id);

  return (
    <main className="workspace-shell">
      <header className="topbar tender-card-topbar">
        <div>
          <p className="eyebrow">Tender card</p>
          <h1>{tender.registryNumber ?? "Без номера"}</h1>
        </div>
        <nav className="topbar-nav" aria-label="Workspace navigation">
          <Link href="/">Overview</Link>
          <Link href="/board">Board</Link>
          <Link href="/watchlists">Watchlists</Link>
          <Link href="/tenders">Tenders</Link>
        </nav>
      </header>

      <section className="tender-hero" aria-label="Tender summary">
        <div className="tender-hero-main">
          <p className="section-kicker">{tender.purchaseMethod ?? "223-ФЗ закупка"}</p>
          <h2>{tender.title}</h2>
          {tender.description ? <p className="tender-description">{tender.description}</p> : null}
          <dl className="tender-meta-grid">
            <div>
              <dt>Заказчик</dt>
              <dd>{tender.customerName ?? "Не указан"}</dd>
            </div>
            <div>
              <dt>ИНН</dt>
              <dd>{tender.customerInn ?? "Не указан"}</dd>
            </div>
            <div>
              <dt>Регион</dt>
              <dd>{tender.region ?? "Не указан"}</dd>
            </div>
            <div>
              <dt>Лот</dt>
              <dd>{tender.lotNumber ?? "Не указан"}</dd>
            </div>
          </dl>
        </div>

        <aside className="tender-summary-panel" aria-label="Decision summary">
          <div>
            <span className="summary-label">Max price</span>
            <strong>{formatMoney(tender.initialPrice, tender.currency)}</strong>
          </div>
          <div>
            <span className="summary-label">Deadline</span>
            <strong>{formatCountdown(tender.submissionDeadline)}</strong>
            <small>{formatDate(tender.submissionDeadline)}</small>
          </div>
          <div className="badge-row">
            <span className="badge badge-decision">
              {decisionLabels[tender.decision] ?? tender.decision}
            </span>
            <span className="score-placeholder">
              Score: {tender.scoreTotal == null ? "—" : tender.scoreTotal}
            </span>
          </div>
        </aside>
      </section>

      <TenderScoringClient tenderId={tender.id} initialScoring={buildInitialScoringView(tender)} />

      <section className="quick-actions" aria-label="Quick actions">
        <form action={requestAnalysisAction}>
          <button
            type="submit"
            className="secondary-button"
            disabled={Boolean(aiRequestDisabledReason)}
            title={aiRequestDisabledReason ?? "Request source-backed AI analysis."}
          >
            {analysisIsBusy ? "AI analysis queued" : "Request AI analysis"}
          </button>
        </form>
        <button type="button" className="secondary-button" disabled>
          Move stage unavailable
        </button>
      </section>

      <section className="stage-split" aria-label="Source and Kanban stages">
        <div>
          <p className="section-kicker">sourceStage</p>
          <span className="badge badge-source">
            {sourceStageLabels[tender.sourceStage] ?? tender.sourceStage}
          </span>
          <small>Подсказка из source documents/deadline; KanbanStage не меняется автоматически.</small>
        </div>
        <div>
          <p className="section-kicker">KanbanStage</p>
          <span className="badge badge-kanban">{tender.kanbanStage.name}</span>
          <code>{tender.kanbanStage.code}</code>
          {tender.kanbanStage.description ? <small>{tender.kanbanStage.description}</small> : null}
        </div>
        <div>
          <p className="section-kicker">Source freshness</p>
          <dl className="freshness-list">
            <div>
              <dt>lastSeenAt</dt>
              <dd>{formatDate(tender.lastSeenAt)}</dd>
            </div>
            <div>
              <dt>updatedFromSourceAt</dt>
              <dd>{formatDate(tender.updatedFromSourceAt)}</dd>
            </div>
            <div>
              <dt>providerMode</dt>
              <dd>{providerModeLabel(tender.providerMode)}</dd>
            </div>
          </dl>
          <small>Upstream updates are refreshed by runs; this is not a real-time stream.</small>
        </div>
      </section>

      <TenderWorkspaceClient
        tenderId={tender.id}
        checklistTemplate={checklistTemplate}
        initialChecklistState={checklistState}
        initialOwnerComment={tender.ownerComment ?? ""}
      />

      <section className="tender-section alert-history-section" aria-labelledby="alerts-heading">
        <div className="section-heading">
          <p className="section-kicker">Alerts</p>
          <h2 id="alerts-heading">История алертов</h2>
        </div>
        {tender.alertDeliveries.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>Алертов пока нет</h3>
            <p>После alerts/run здесь появятся записи AlertDelivery без sensitive payload.</p>
          </div>
        ) : (
          <ol className="alert-history-list">
            {tender.alertDeliveries.map((alert) => {
              const deliveryDisplay = deriveAlertDeliveryDisplay(alert);

              return (
                <li key={alert.id}>
                  <div>
                    <span className="badge badge-alert">
                      {alertTypeLabels[alert.type] ?? alert.type}
                    </span>
                    <strong>{alert.channel}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>mode</dt>
                      <dd>{deliveryDisplay.mode}</dd>
                    </div>
                    <div>
                      <dt>status</dt>
                      <dd>{deliveryDisplay.status}</dd>
                    </div>
                    <div>
                      <dt>created</dt>
                      <dd>{formatDate(alert.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>sentAt</dt>
                      <dd>{formatDate(alert.sentAt)}</dd>
                    </div>
                    <div>
                      <dt>acknowledgedAt</dt>
                      <dd>{formatDate(alert.acknowledgedAt)}</dd>
                    </div>
                  </dl>
                  {alert.errorMessage ? <p className="alert-error">{alert.errorMessage}</p> : null}
                  {!alert.acknowledgedAt ? (
                    <form action={acknowledgeAlertFromForm.bind(null, tender.id, alert.channel, alert.type)}>
                      <button type="submit" className="secondary-button">
                        Acknowledge
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="tender-card-grid">
        <section className="tender-section" aria-labelledby="economics-heading">
          <div className="section-heading">
            <p className="section-kicker">Economics</p>
            <h2 id="economics-heading">Экономика участия</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>maxPrice</dt>
              <dd>{formatMoney(tender.initialPrice, tender.currency)}</dd>
            </div>
            <div>
              <dt>bidSecurityAmount</dt>
              <dd>{formatMoney(tender.bidSecurityAmount, tender.currency)}</dd>
            </div>
            <div>
              <dt>contractSecurityAmount</dt>
              <dd>{formatMoney(tender.contractSecurityAmount, tender.currency)}</dd>
            </div>
            <div>
              <dt>paymentTerms</dt>
              <dd>{tender.paymentTerms ?? "Не указано"}</dd>
            </div>
          </dl>
        </section>

        <section className="tender-section" aria-labelledby="timeline-heading">
          <div className="section-heading">
            <p className="section-kicker">Timeline</p>
            <h2 id="timeline-heading">Ключевые даты</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>publishedAt</dt>
              <dd>{formatDate(tender.publishedAt)}</dd>
            </div>
            <div>
              <dt>applicationStartAt</dt>
              <dd>{formatDate(tender.applicationStartAt)}</dd>
            </div>
            <div>
              <dt>applicationDeadlineAt</dt>
              <dd>{formatDate(tender.submissionDeadline)}</dd>
            </div>
            <div>
              <dt>clarificationDeadlineAt</dt>
              <dd>{formatDate(tender.clarificationDeadlineAt)}</dd>
            </div>
            <div>
              <dt>resultAt</dt>
              <dd>{formatDate(tender.resultAt)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="tender-section" aria-labelledby="requirements-heading">
        <div className="section-heading">
          <p className="section-kicker">Requirements</p>
          <h2 id="requirements-heading">Требования и критерии</h2>
        </div>
        <div className="requirements-grid">
          <ListBlock title="participationRequirements" items={participationRequirements} />
          <ListBlock title="requiredDocuments" items={requiredDocuments} />
          <ListBlock title="evaluationCriteria" items={evaluationCriteria} />
        </div>
      </section>

      <section className="tender-section" aria-labelledby="documents-heading">
        <div className="section-heading">
          <p className="section-kicker">Documents</p>
          <h2 id="documents-heading">Документы</h2>
        </div>
        {tender.documents.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>Документы не найдены</h3>
            <p>В mock fixture для этой закупки нет нормализованного списка документов.</p>
          </div>
        ) : (
          <div className="documents-table-wrap">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>type</th>
                  <th>fileName / title</th>
                  <th>status</th>
                  <th>text</th>
                </tr>
              </thead>
              <tbody>
                {tender.documents.map((document) => (
                  <tr key={document.id}>
                    <td>{documentTypeLabels[document.type] ?? document.type}</td>
                    <td>
                      {document.status !== "MISSING" && (document.sourceUrl || document.storageKey) ? (
                        <a href={`/api/files/${document.id}`} target="_blank" rel="noreferrer">
                          {document.fileName ?? document.title}
                        </a>
                      ) : (
                        <span>{document.fileName ?? document.title}</span>
                      )}
                      <small>{document.title}</small>
                    </td>
                    <td>
                      <span className="badge badge-document">
                        {documentStatusLabels[document.status] ?? document.status}
                      </span>
                      {document.storageKey ? <small>served through file proxy</small> : null}
                    </td>
                    <td>
                      <span className="badge badge-document">
                        {documentExtractionStatusLabels[document.extractionStatus] ??
                          document.extractionStatus}
                      </span>
                      {document.textChecksum ? <code>{document.textChecksum.slice(0, 12)}</code> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tender-card-grid" aria-label="Changes and AI">
        <div className="tender-section">
          <div className="section-heading">
            <p className="section-kicker">Changes</p>
            <h2>Лента изменений</h2>
          </div>
          {changes.length === 0 ? (
            <div className="empty-state compact-empty">
              <h3>Изменений нет</h3>
              <p>В mock changesFeed для этой закупки пока нет записей.</p>
            </div>
          ) : (
            <ol className="change-list">
              {changes.map((change) => (
                <li key={`${change.at}-${change.title}`}>
                  <time dateTime={change.at}>{formatDate(change.at)}</time>
                  <strong>{change.title}</strong>
                  {change.description ? <span>{change.description}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        <AIAnalysisPanel
          tenderId={tender.id}
          documents={tender.documents}
          latestAnalysis={latestAnalysis}
          requestAction={requestAnalysisAction}
          formatDate={formatDate}
        />
      </section>
    </main>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="list-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
