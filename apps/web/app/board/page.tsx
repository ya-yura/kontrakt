import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { BoardClient, type BoardStageView, type BoardTenderView } from "./board-client";
import { requireCurrentUser } from "@/src/auth/dev-auth";
import {
  calculateChecklistProgress,
  parseChecklistState,
  parseChecklistTemplate
} from "@/src/board/checklist";
import { findBoardStagesForUser } from "@/src/board/queries";
import { getPrismaClient } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

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

function toStageView(stage: {
  code: string;
  name: string;
  description: string | null;
  isTerminal: boolean;
}): BoardStageView {
  return {
    code: stage.code,
    name: stage.name,
    description: stage.description,
    isTerminal: stage.isTerminal
  };
}

function toTenderView(tender: {
  id: string;
  externalId: string;
  registryNumber: string | null;
  title: string;
  customerName: string | null;
  initialPrice: Prisma.Decimal | null;
  currency: string;
  submissionDeadline: Date | null;
  sourceStage: string;
  decision: string;
  scoreTotal: number | null;
  checklistState: Prisma.JsonValue | null;
  kanbanStage: {
    code: string;
    name: string;
    checklistTemplate: Prisma.JsonValue | null;
  };
}): BoardTenderView {
  return {
    id: tender.id,
    registryNumber: tender.registryNumber,
    purchaseNumber: tender.externalId,
    title: tender.title,
    customerName: tender.customerName ?? "Не указан",
    maxPrice: formatPrice(tender.initialPrice, tender.currency),
    applicationDeadlineAt: formatDeadline(tender.submissionDeadline),
    sourceStage: tender.sourceStage,
    sourceStageLabel: sourceStageLabels[tender.sourceStage] ?? tender.sourceStage,
    kanbanStageCode: tender.kanbanStage.code,
    kanbanStageName: tender.kanbanStage.name,
    decision: tender.decision,
    decisionLabel: decisionLabels[tender.decision] ?? tender.decision,
    scoreTotal: tender.scoreTotal,
    checklistProgress: calculateChecklistProgress(
      parseChecklistTemplate(tender.kanbanStage.checklistTemplate),
      parseChecklistState(tender.checklistState)
    )
  };
}

export default async function BoardPage() {
  const currentUser = await requireCurrentUser();
  const prisma = getPrismaClient();
  const [stages, tenders] = await Promise.all([
    findBoardStagesForUser(prisma, currentUser.id),
    prisma.tender.findMany({
      where: {
        ownerId: currentUser.id
      },
      orderBy: [{ submissionDeadline: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        externalId: true,
        registryNumber: true,
        title: true,
        customerName: true,
        initialPrice: true,
        currency: true,
        submissionDeadline: true,
        sourceStage: true,
        decision: true,
        scoreTotal: true,
        checklistState: true,
        kanbanStage: {
          select: {
            code: true,
            name: true,
            checklistTemplate: true
          }
        }
      }
    })
  ]);

  const stageViews = stages.map(toStageView);
  const tenderViews = tenders.map(toTenderView);

  return (
    <main className="workspace-shell board-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sprint 03</p>
          <h1>Operational board</h1>
        </div>
        <nav className="topbar-nav" aria-label="Workspace navigation">
          <Link href="/">Overview</Link>
          <Link href="/tenders">Tenders</Link>
          <Link href="/watchlists">Watchlists</Link>
        </nav>
      </header>

      <section className="board-toolbar" aria-label="Board summary">
        <div>
          <p className="section-kicker">Current user</p>
          <h2>{currentUser.email}</h2>
          <p className="toolbar-note">
            Source stage is a source signal. Work stage is the supplier team pipeline and is moved
            manually on this board.
          </p>
        </div>
        <dl className="board-summary-list">
          <div>
            <dt>KanbanStage</dt>
            <dd>{stageViews.length}</dd>
          </div>
          <div>
            <dt>Tender</dt>
            <dd>{tenderViews.length}</dd>
          </div>
        </dl>
      </section>

      {stageViews.length === 0 ? (
        <section className="empty-state" aria-label="No stages">
          <h3>KanbanStage не настроены</h3>
          <p>
            Для board нужны стадии рабочего процесса. Запустите seed или миграцию, которая создает
            default KanbanStage records.
          </p>
        </section>
      ) : (
        <BoardClient stages={stageViews} initialCards={tenderViews} />
      )}
    </main>
  );
}
