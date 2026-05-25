# Day 10: 2026-06-05 - Source stage, freshness, control sample, weekly demo

## Goal

Закрыть Sprint 02: вывести `sourceStage`, показать source freshness, добавить ручное обновление закупки при необходимости и провести контрольную проверку 20 закупок/live-shaped fixtures.

## Implementation prompt

```text
Ты senior product/integration engineer. Сегодня Day 10 Sprint 02 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web tenders/card/list, source stage utility, cron/upsert, tests и минимально apps/api fixtures при необходимости.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 09 должен был подключить watchlist cron/upsert.
- Tenders и Documents теперь приходят через FastAPI DTO и пишутся только Next.js/Prisma.
- Внутренний kanbanStage нельзя менять автоматически из sourceStage.

Задача дня: source stage, freshness и Sprint 02 demo readiness.

Сделай только это:
1. Реализуй/дополни utility `deriveSourceStage` на стороне Next.js:
   - только notice/documentation и дедлайн не прошел -> SUBMISSION_OPEN
   - есть protocol -> COMMISSION_WORK
   - есть result/final protocol -> COMPLETED
   - есть cancellation/canceled marker -> CANCELED
   - deadline прошел, результата нет -> EXPIRED
   - иначе UNKNOWN
2. Сохраняй/обновляй `Tender.sourceStage` при upsert.
3. Не меняй `kanbanStageId` автоматически. Допускается только UI suggestion/notice.
4. Добавь source freshness в list/card:
   - lastSeenAt
   - updatedFromSourceAt
   - providerMode fixture/live
   - понятный текст, что upstream не real-time stream.
5. Добавь ручное действие "refresh tender" или "refresh watchlist" только если оно логично уже встроено:
   - auth
   - ownership
   - typed ActionResult
   - вызывает normalize/upsert для одной закупки или run для фильтра.
6. Добавь tests для deriveSourceStage.
7. Подготовь `docs/progress/week-02-demo.md`:
   - что работает
   - demo path
   - контрольная выборка 20 закупок или fixture reason
   - таблица проверки: price, deadline, customer, documents, sourceStage
   - что не входит в Sprint 02
   - must-fix перед Sprint 03

Жесткие ограничения:
- Не делай AI.
- Не делай scoring engine.
- Не делай alerts.
- Не реализуй kanban movement, если он не был сделан раньше.
- Не утверждай, что source updates real-time.
- Не скрывай отсутствие live API key: если работали fixtures, явно зафиксируй это как PARTIAL/BLOCKED для live validation.

Acceptance criteria:
- sourceStage выводится по документам/дедлайнам и сохраняется.
- kanbanStage остается независимым.
- UI показывает source freshness.
- 20 закупок проверены на price, deadline, customer, documents, sourceStage; либо есть честный fixture-based отчет и blocker по live API.
- Sprint 02 status зафиксирован как DONE/PARTIAL/BLOCKED.
- Первый recommended task для Sprint 03 указан.

После реализации верни:
- Sprint 02 status;
- demo path;
- tests run;
- control sample summary;
- blockers для Sprint 03.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 10 и готовность Sprint 02.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только source stage utility, UI freshness, cron/upsert behavior, demo notes и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. deriveSourceStage покрывает notice/protocol/result/canceled/expired/unknown.
2. sourceStage сохраняется при upsert.
3. kanbanStage не меняется автоматически.
4. UI показывает source freshness и не обещает real-time.
5. Control sample 20 закупок реально зафиксирован или честно указан blocker по live source.
6. Повторный cron run по-прежнему без дублей.
7. Нет AI/scoring/alerts вне scope.
8. Week 02 demo notes достаточно понятны для передачи следующему агенту.

Ответ:
- Findings first.
- Затем Sprint 02 status: DONE/PARTIAL/BLOCKED.
- Затем must-fix перед Sprint 03.
```

## Daily result log

```md
# 2026-06-05

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Закрыть sourceStage, source freshness и Sprint 02 demo.

## Done
-

## Checks
-

## Evidence
- deriveSourceStage tests:
- Source freshness UI:
- Control sample:
- Weekly demo notes:

## Decisions
-

## Blockers
-

## Sprint 02 result
DONE | PARTIAL | BLOCKED

## Sprint 03 first task
Начать с Kanban board и moveTenderToStage ownership-safe action.
```
