# Day 11: 2026-06-08 - Kanban board and stage movement

## Goal

Реализовать внутреннюю канбан-доску закупок и безопасное перемещение карточек между `KanbanStage`, не смешивая это с `Tender.sourceStage`.

## Implementation prompt

```text
Ты senior Next.js/Product engineer. Сегодня Day 11, первый день Sprint 03 MVP Operational Workspace для поставщика по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web для tenders, kanban stages, Prisma, actions, routes и UI.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Sprint 02 завершен: закупки подтягиваются через watchlist cron, Tender/Document upsert работает, sourceStage и source freshness отображаются.
- Next.js является единственным writer в PostgreSQL через Prisma.
- FastAPI не участвует в канбане.
- Tender.sourceStage и KanbanStage всегда независимы.

Задача дня: kanban board + move action.

Сделай только это:
1. Реализуй страницу `/board` или существующий board route.
2. Колонки строятся из `KanbanStage`, отсортированы по `position`.
3. Карточки берутся из `Tender` текущего пользователя.
4. На карточке покажи:
   - registryNumber/purchaseNumber
   - title
   - customerName
   - maxPrice
   - applicationDeadlineAt
   - sourceStage
   - kanbanStage
   - decision
   - score placeholder/scoreTotal, если уже есть
5. Реализуй Server Function `moveTenderToStage(tenderId, stageCode)`:
   - auth()
   - Zod validation
   - ownership check tender + target stage
   - typed ActionResult
   - update только `kanbanStageId`
   - revalidatePath для board и tender card
6. UI movement может быть простым: select/button/menu. Drag-and-drop необязателен сегодня, если он раздувает scope.
7. Добавь empty states:
   - нет закупок
   - нет stages
   - колонка пустая
8. Добавь tests для move action:
   - happy path
   - чужой tender rejected
   - invalid stage rejected
   - sourceStage не меняется.

Жесткие ограничения:
- Не меняй `Tender.sourceStage` при перемещении карточки.
- Не делай checklist сегодня.
- Не делай scoring engine.
- Не делай alerts.
- Не вызывай FastAPI.

Acceptance criteria:
- Пользователь видит board с колонками и карточками.
- Карточка перемещается между стадиями и сохраняется.
- `sourceStage` остается прежним.
- Чужие tender/stage не доступны.
- UI clearly separates source stage and work stage.

После реализации верни:
- измененные файлы;
- как перемещать карточку;
- tests/checks run;
- residual risks.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 11.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только board UI, move action, Prisma queries и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Board строится из KanbanStage текущего user.
2. Карточки принадлежат текущему user.
3. moveTenderToStage делает auth, validation, ownership.
4. sourceStage не меняется при move.
5. kanbanStage меняется только на валидный stage текущего user.
6. Empty states есть.
7. Нет FastAPI/scoring/alerts/checklists вне scope.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий board movement.
```

## Daily result log

```md
# 2026-06-08

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать Kanban board и безопасное перемещение карточек.

## Done
-

## Checks
-

## Evidence
- Board URL:
- Move action:
- sourceStage unchanged:

## Decisions
-

## Blockers
-

## Next day input
Day 12 должен добавить checklist state, stage templates и owner comments.
```

