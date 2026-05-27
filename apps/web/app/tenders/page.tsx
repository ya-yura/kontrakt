import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { requireCurrentUser } from "@/src/auth/dev-auth";
import { getPrismaClient } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

type TenderSort = "deadline" | "deadline_desc" | "price" | "price_desc";

type TendersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const sortLabels: Record<TenderSort, string> = {
  deadline: "Дедлайн ↑",
  deadline_desc: "Дедлайн ↓",
  price: "Цена ↑",
  price_desc: "Цена ↓"
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

function parseSort(value: string | string[] | undefined): TenderSort {
  const sort = Array.isArray(value) ? value[0] : value;

  if (sort === "deadline_desc" || sort === "price" || sort === "price_desc") {
    return sort;
  }

  return "deadline";
}

function getOrderBy(sort: TenderSort): Prisma.TenderOrderByWithRelationInput[] {
  if (sort === "deadline_desc") {
    return [{ submissionDeadline: "desc" }, { initialPrice: "desc" }];
  }

  if (sort === "price") {
    return [{ initialPrice: "asc" }, { submissionDeadline: "asc" }];
  }

  if (sort === "price_desc") {
    return [{ initialPrice: "desc" }, { submissionDeadline: "asc" }];
  }

  return [{ submissionDeadline: "asc" }, { initialPrice: "desc" }];
}

function formatPrice(value: Prisma.Decimal | null, currency: string) {
  if (!value) {
    return "Не указана";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value.toString()));
}

function formatDeadline(value: Date | null) {
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

function formatNullableDateTime(value: Date | null) {
  return value ? formatDeadline(value) : "Не указан";
}

function providerModeLabel(value: string) {
  if (value === "live") {
    return "live";
  }

  return "fixture";
}

export default async function TendersPage({ searchParams }: TendersPageProps) {
  const currentUser = await requireCurrentUser();
  const params = searchParams ? await searchParams : {};
  const sort = parseSort(params.sort);
  const prisma = getPrismaClient();
  const tenders = await prisma.tender.findMany({
    where: {
      ownerId: currentUser.id
    },
    orderBy: getOrderBy(sort),
    select: {
      id: true,
      registryNumber: true,
      title: true,
      customerInn: true,
      customerName: true,
      initialPrice: true,
      currency: true,
      submissionDeadline: true,
      lastSeenAt: true,
      updatedFromSourceAt: true,
      providerMode: true,
      sourceStage: true,
      decision: true,
      scoreTotal: true,
      kanbanStage: {
        select: {
          code: true,
          name: true
        }
      },
      _count: {
        select: {
          documents: true
        }
      }
    }
  });

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mock EIS 223-ФЗ</p>
          <h1>Закупки</h1>
        </div>
        <nav className="topbar-nav" aria-label="Workspace navigation">
          <Link href="/">Overview</Link>
          <Link href="/board">Board</Link>
          <Link href="/watchlists">Watchlists</Link>
        </nav>
      </header>

      <section className="tenders-toolbar" aria-label="Tender list controls">
        <div>
          <p className="section-kicker">Daily work list</p>
          <h2>{tenders.length} закупок в рабочем списке</h2>
          <p className="toolbar-note">
            Source freshness показывает последний refresh в workspace. Upstream не является
            real-time stream.
          </p>
        </div>
        <div className="sort-links" aria-label="Tender sorting">
          {(Object.keys(sortLabels) as TenderSort[]).map((sortOption) => (
            <Link
              key={sortOption}
              className={sort === sortOption ? "is-active" : undefined}
              href={`/tenders?sort=${sortOption}`}
            >
              {sortLabels[sortOption]}
            </Link>
          ))}
        </div>
      </section>

      {tenders.length === 0 ? (
        <section className="empty-state" aria-label="No tenders">
          <h3>Закупок пока нет</h3>
          <p>
            После seed или подключения источника здесь появится рабочий список закупок. Это не
            ошибка: сейчас для пользователя нет сохраненных tender records.
          </p>
        </section>
      ) : (
        <section className="tenders-table-wrap" aria-label="Tender list">
          <table className="tenders-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Закупка</th>
                <th>Заказчик</th>
                <th>Max price</th>
                <th>applicationDeadlineAt</th>
                <th>sourceStage</th>
                <th>Freshness</th>
                <th>KanbanStage</th>
                <th>Decision</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {tenders.map((tender) => (
                <tr key={tender.id}>
                  <td>
                    <Link className="registry-link" href={`/tenders/${tender.id}`}>
                      {tender.registryNumber ?? "Без номера"}
                    </Link>
                  </td>
                  <td className="tender-title-cell">
                    <Link href={`/tenders/${tender.id}`}>{tender.title}</Link>
                    <span>{tender._count.documents} docs</span>
                  </td>
                  <td>
                    <strong>{tender.customerName ?? "Не указан"}</strong>
                    {tender.customerInn ? <span>ИНН {tender.customerInn}</span> : null}
                  </td>
                  <td>{formatPrice(tender.initialPrice, tender.currency)}</td>
                  <td>{formatDeadline(tender.submissionDeadline)}</td>
                  <td>
                    <span className="badge badge-source">
                      {sourceStageLabels[tender.sourceStage] ?? tender.sourceStage}
                    </span>
                  </td>
                  <td>
                    <span className="freshness-line">
                      lastSeenAt: {formatNullableDateTime(tender.lastSeenAt)}
                    </span>
                    <span className="freshness-line">
                      updatedFromSourceAt: {formatNullableDateTime(tender.updatedFromSourceAt)}
                    </span>
                    <span className="freshness-line">
                      providerMode: {providerModeLabel(tender.providerMode)}
                    </span>
                    <span className="freshness-note">Upstream не real-time stream</span>
                  </td>
                  <td>
                    <span className="badge badge-kanban">{tender.kanbanStage.name}</span>
                    <code>{tender.kanbanStage.code}</code>
                  </td>
                  <td>
                    <span className="badge badge-decision">
                      {decisionLabels[tender.decision] ?? tender.decision}
                    </span>
                  </td>
                  <td>
                    <span className="score-placeholder">
                      {tender.scoreTotal == null ? "—" : tender.scoreTotal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
