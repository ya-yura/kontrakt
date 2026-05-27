"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { moveTenderToStage } from "./actions";

export type BoardStageView = {
  code: string;
  name: string;
  description: string | null;
  isTerminal: boolean;
};

export type BoardTenderView = {
  id: string;
  registryNumber: string | null;
  purchaseNumber: string;
  title: string;
  customerName: string;
  maxPrice: string;
  applicationDeadlineAt: string;
  sourceStage: string;
  sourceStageLabel: string;
  kanbanStageCode: string;
  kanbanStageName: string;
  decision: string;
  decisionLabel: string;
  scoreTotal: number | null;
  checklistProgress: {
    checked: number;
    total: number;
    percent: number;
  };
};

type BoardNotice = {
  tone: "success" | "error";
  message: string;
};

type BoardClientProps = {
  stages: BoardStageView[];
  initialCards: BoardTenderView[];
};

function groupCardsByStage(stages: BoardStageView[], cards: BoardTenderView[]) {
  const groups = new Map(stages.map((stage) => [stage.code, [] as BoardTenderView[]]));

  for (const card of cards) {
    const stageCards = groups.get(card.kanbanStageCode);

    if (stageCards) {
      stageCards.push(card);
    }
  }

  return groups;
}

function initialSelectedStages(cards: BoardTenderView[]) {
  return Object.fromEntries(cards.map((card) => [card.id, card.kanbanStageCode]));
}

export function BoardClient({ stages, initialCards }: BoardClientProps) {
  const [cards, setCards] = useState(initialCards);
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>(() =>
    initialSelectedStages(initialCards)
  );
  const [noticeByTenderId, setNoticeByTenderId] = useState<Record<string, BoardNotice>>({});
  const [pendingTenderId, setPendingTenderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cardsByStage = useMemo(() => groupCardsByStage(stages, cards), [cards, stages]);

  function updateSelectedStage(tenderId: string, stageCode: string) {
    setSelectedStages((current) => ({
      ...current,
      [tenderId]: stageCode
    }));
  }

  function setNotice(tenderId: string, notice: BoardNotice | null) {
    setNoticeByTenderId((current) => {
      const next = { ...current };

      if (notice) {
        next[tenderId] = notice;
      } else {
        delete next[tenderId];
      }

      return next;
    });
  }

  function handleMove(card: BoardTenderView) {
    const targetStageCode = selectedStages[card.id] ?? card.kanbanStageCode;

    if (targetStageCode === card.kanbanStageCode) {
      return;
    }

    setPendingTenderId(card.id);
    setNotice(card.id, null);

    startTransition(async () => {
      const result = await moveTenderToStage(card.id, targetStageCode);

      if (!result.ok) {
        setNotice(card.id, {
          tone: "error",
          message: result.error.message
        });
        setPendingTenderId(null);
        return;
      }

      setCards((current) =>
        current.map((item) =>
          item.id === card.id
            ? {
                ...item,
                kanbanStageCode: result.data.stage.code,
                kanbanStageName: result.data.stage.name,
                sourceStage: result.data.sourceStage,
                checklistProgress: result.data.checklistProgress
              }
            : item
        )
      );
      updateSelectedStage(card.id, result.data.stage.code);
      setNotice(card.id, {
        tone: "success",
        message: `Перемещено в ${result.data.stage.name}.`
      });
      setPendingTenderId(null);
    });
  }

  return (
    <section className="board-workspace" aria-label="Kanban board">
      {cards.length === 0 ? (
        <div className="empty-state board-empty" aria-label="No tenders">
          <h3>Закупок пока нет</h3>
          <p>
            После seed или refresh watchlist здесь появятся карточки текущего пользователя.
          </p>
        </div>
      ) : null}

      <div className="board-columns" aria-label="Kanban stages">
        {stages.map((stage) => {
          const stageCards = cardsByStage.get(stage.code) ?? [];

          return (
            <section className="board-column" key={stage.code} aria-label={stage.name}>
              <header className="board-column-header">
                <div>
                  <h2>{stage.name}</h2>
                  <code>{stage.code}</code>
                </div>
                <span className="count-pill">{stageCards.length}</span>
              </header>
              <div className="board-column-meta">
                {stage.description ? <p>{stage.description}</p> : <p>Описание стадии не задано.</p>}
                {stage.isTerminal ? <span>terminal</span> : null}
              </div>

              {stageCards.length === 0 ? (
                <div className="empty-state board-column-empty">
                  <h3>Колонка пустая</h3>
                  <p>Нет закупок на этой рабочей стадии.</p>
                </div>
              ) : (
                <ul className="board-card-list">
                  {stageCards.map((card) => {
                    const selectedStageCode = selectedStages[card.id] ?? card.kanbanStageCode;
                    const notice = noticeByTenderId[card.id];
                    const isCurrentCardPending = isPending && pendingTenderId === card.id;

                    return (
                      <li className="board-card" key={card.id}>
                        <div className="board-card-header">
                          <Link className="registry-link" href={`/tenders/${card.id}`}>
                            {card.registryNumber ?? "Без registryNumber"}
                          </Link>
                          <span>purchaseNumber: {card.purchaseNumber}</span>
                        </div>

                        <h3>
                          <Link href={`/tenders/${card.id}`}>{card.title}</Link>
                        </h3>

                        <dl className="board-card-meta-grid">
                          <div>
                            <dt>customerName</dt>
                            <dd>{card.customerName}</dd>
                          </div>
                          <div>
                            <dt>maxPrice</dt>
                            <dd>{card.maxPrice}</dd>
                          </div>
                          <div>
                            <dt>applicationDeadlineAt</dt>
                            <dd>{card.applicationDeadlineAt}</dd>
                          </div>
                          <div>
                            <dt>decision</dt>
                            <dd>
                              <span className="badge badge-decision">{card.decisionLabel}</span>
                            </dd>
                          </div>
                        </dl>

                        <div className="board-stage-pair" aria-label="Source and work stages">
                          <div>
                            <span>sourceStage</span>
                            <strong className="badge badge-source">{card.sourceStageLabel}</strong>
                          </div>
                          <div>
                            <span>kanbanStage</span>
                            <strong className="badge badge-kanban">{card.kanbanStageName}</strong>
                          </div>
                        </div>

                        <div className="board-score-row">
                          <span>scoreTotal</span>
                          <strong className="score-placeholder">
                            {card.scoreTotal == null ? "—" : card.scoreTotal}
                          </strong>
                        </div>

                        <div className="board-progress-row" aria-label="Checklist progress">
                          <div>
                            <span>checklist</span>
                            <strong>{card.checklistProgress.percent}%</strong>
                            <small>
                              {card.checklistProgress.checked}/{card.checklistProgress.total}
                            </small>
                          </div>
                          <div className="progress-track" aria-hidden="true">
                            <span style={{ width: `${card.checklistProgress.percent}%` }} />
                          </div>
                        </div>

                        <div className="board-move-control">
                          <label className="field">
                            <span>Work stage</span>
                            <select
                              disabled={isCurrentCardPending}
                              onChange={(event) => updateSelectedStage(card.id, event.target.value)}
                              value={selectedStageCode}
                            >
                              {stages.map((option) => (
                                <option key={option.code} value={option.code}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="secondary-button"
                            disabled={
                              isCurrentCardPending || selectedStageCode === card.kanbanStageCode
                            }
                            onClick={() => handleMove(card)}
                            type="button"
                          >
                            {isCurrentCardPending ? "Moving" : "Move"}
                          </button>
                        </div>

                        {notice ? (
                          <p
                            className={
                              notice.tone === "success" ? "board-card-success" : "field-error"
                            }
                          >
                            {notice.message}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
