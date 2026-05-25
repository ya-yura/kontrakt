import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/src/auth/dev-auth";
import { getPrismaClient } from "@/src/lib/prisma";

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
  DRAFT: "Draft",
  PUBLISHED: "Published",
  APPLICATIONS_OPEN: "Applications open",
  APPLICATIONS_REVIEW: "Applications review",
  RESULTS_PUBLISHED: "Results published",
  CONTRACTING: "Contracting",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
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

export default async function TenderCardPage({ params }: TenderCardPageProps) {
  const [{ id }, currentUser] = await Promise.all([params, requireCurrentUser()]);
  const prisma = getPrismaClient();
  const tender = await prisma.tender.findFirst({
    where: {
      id,
      ownerId: currentUser.id
    },
    select: {
      id: true,
      registryNumber: true,
      lotNumber: true,
      title: true,
      description: true,
      customerInn: true,
      customerName: true,
      purchaseMethod: true,
      initialPrice: true,
      currency: true,
      region: true,
      sourceUrl: true,
      publishedAt: true,
      applicationStartAt: true,
      submissionDeadline: true,
      clarificationDeadlineAt: true,
      resultAt: true,
      bidSecurityAmount: true,
      contractSecurityAmount: true,
      paymentTerms: true,
      participationRequirements: true,
      requiredDocuments: true,
      evaluationCriteria: true,
      changesFeed: true,
      sourceStage: true,
      decision: true,
      kanbanStage: {
        select: {
          code: true,
          name: true,
          description: true
        }
      },
      documents: {
        orderBy: [{ createdAt: "asc" }, { title: "asc" }],
        select: {
          id: true,
          type: true,
          title: true,
          fileName: true,
          status: true,
          sourceUrl: true,
          storageKey: true
        }
      }
    }
  });

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

  return (
    <main className="workspace-shell">
      <header className="topbar tender-card-topbar">
        <div>
          <p className="eyebrow">Tender card</p>
          <h1>{tender.registryNumber ?? "Без номера"}</h1>
        </div>
        <nav className="topbar-nav" aria-label="Workspace navigation">
          <Link href="/">Overview</Link>
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
            <span className="score-placeholder">Score: —</span>
          </div>
        </aside>
      </section>

      <section className="quick-actions" aria-label="Unavailable quick actions">
        <button type="button" className="secondary-button" disabled>
          Rescore unavailable
        </button>
        <button type="button" className="secondary-button" disabled>
          Run AI unavailable
        </button>
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
        </div>
        <div>
          <p className="section-kicker">KanbanStage</p>
          <span className="badge badge-kanban">{tender.kanbanStage.name}</span>
          <code>{tender.kanbanStage.code}</code>
          {tender.kanbanStage.description ? <small>{tender.kanbanStage.description}</small> : null}
        </div>
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
                </tr>
              </thead>
              <tbody>
                {tender.documents.map((document) => (
                  <tr key={document.id}>
                    <td>{documentTypeLabels[document.type] ?? document.type}</td>
                    <td>
                      {document.sourceUrl ? (
                        <a href={document.sourceUrl} target="_blank" rel="noreferrer">
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
                      {document.storageKey ? <code>{document.storageKey}</code> : null}
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

        <div className="tender-section">
          <div className="section-heading">
            <p className="section-kicker">AI</p>
            <h2>Анализ</h2>
          </div>
          <div className="empty-state compact-empty">
            <h3>AI-анализ еще не запускался</h3>
            <p>
              В Sprint 01 карточка намеренно не показывает сгенерированные выводы, scoring или
              рекомендации.
            </p>
          </div>
        </div>
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
