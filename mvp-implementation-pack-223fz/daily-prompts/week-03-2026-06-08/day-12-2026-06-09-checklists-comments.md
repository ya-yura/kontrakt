# Day 12: 2026-06-09 - Checklist state and owner comments

## Goal

Добавить stage-specific checklist templates, сохранение `Tender.checklistState`, прогресс готовности и `ownerComment` для внутренней работы по закупке.

## Implementation prompt

```text
Ты senior Next.js engineer. Сегодня Day 12 Sprint 03 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web board, tender card, Prisma, actions, validators и seed.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 11 должен был добавить board и moveTenderToStage.
- KanbanStage уже имеет/может иметь `checklistTemplate`.
- Tender имеет `checklistState` и `ownerComment`.

Задача дня: checklist + comments.

Сделай только это:
1. Добавь default checklist templates в seed для стадий:
   - INBOX: проверить релевантность, дедлайн, заказчика
   - QUALIFY: проверить регион, цену, обеспечение, ключевые требования
   - GO: подтвердить решение, назначить ответственного, проверить blockers
   - PREPARE: собрать документы, проверить форму заявки, проверить подпись/ЭТП
   - SUBMITTED_EXTERNALLY: зафиксировать факт подачи, сохранить номер/комментарий
   - WON/LOST/ARCHIVED: закрывающие короткие пункты
2. Реализуй schema для checklistState:
   - items keyed by stable item id
   - checked boolean
   - updatedAt
3. Реализуй Server Functions:
   - updateTenderChecklist(tenderId, checklistState)
   - updateTenderOwnerComment(tenderId, ownerComment)
4. Каждая mutation:
   - auth()
   - Zod validation
   - ownership check
   - typed ActionResult
   - revalidatePath board/card
5. UI:
   - на tender card показать checklist текущей стадии
   - на board card показать процент готовности
   - ownerComment редактируемый на tender card
6. При переходе стадии не удаляй старый checklistState. Если для новой стадии нет state, UI строит его из template.
7. Добавь tests:
   - checklist validation
   - ownership rejected
   - progress calculation
   - ownerComment update.

Жесткие ограничения:
- Не делай scoring сегодня.
- Не делай alerts.
- Не запускай AI.
- Не меняй sourceStage.
- Не удаляй checklist data при смене стадии.

Acceptance criteria:
- Checklist отображается на tender card.
- Чекбоксы сохраняются.
- Progress виден на board card.
- Owner comment сохраняется.
- Invalid checklist payload rejected.
- Checklist survives stage movement.

После реализации верни:
- измененные файлы;
- checklist state shape;
- tests/checks run;
- что осталось для scoring.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 12.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только checklist/comment actions, validators, UI и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Checklist templates seeded for stages.
2. updateTenderChecklist делает auth, validation, ownership.
3. Invalid checklistState rejected.
4. Checklist не теряется при смене stage.
5. Progress calculation корректен.
6. Owner comment сохраняется и принадлежит tender owner.
7. Нет scoring/alerts/AI вне scope.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий checklist.
```

## Daily result log

```md
# 2026-06-09

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Добавить checklist state, progress и owner comments.

## Done
-

## Checks
-

## Evidence
- Tender card checklist:
- Board progress:
- Owner comment:

## Decisions
-

## Blockers
-

## Next day input
Day 13 должен реализовать rule-based bid/no-bid scoring v1.
```

