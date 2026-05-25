# Day 09: 2026-06-04 - Watchlist cron, FastAPI client, Tender/Document upsert

## Goal

Подключить Next.js к FastAPI search/normalize: `POST /api/cron/watchlists/run`, manual run action, idempotent upsert `Tender` и `Document`, обновление `SavedFilter.lastRunAt/lastCursor/lastResultCount`.

## Implementation prompt

```text
Ты senior Next.js/Prisma engineer. Сегодня Day 09 Sprint 02 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web auth/prisma/actions/routes/fastapi client/validators и минимально apps/api contract examples при необходимости.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 07: FastAPI search endpoint.
- Day 08: FastAPI normalize endpoint и Next-side DTO validation/mapping.
- Next.js является единственным writer в PostgreSQL.
- FastAPI не пишет бизнес-состояние.
- SavedFilter CRUD уже есть.

Задача дня: watchlist execution pipeline.

Сделай только это:
1. Добавь FastAPI client в apps/web:
   - POST /v1/eis223/search
   - POST /v1/eis223/purchase/{externalPurchaseId}/normalize
   - timeout
   - typed errors
   - internal token/header если уже предусмотрен env.
2. Реализуй `POST /api/cron/watchlists/run`:
   - только POST
   - Authorization: Bearer ${CRON_SECRET}
   - lock от параллельного запуска
   - batch active SavedFilter
   - вызывает search
   - для новых/измененных hits вызывает normalize
   - upsert Tender по [userId, externalPurchaseId, lotNumber]
   - upsert Document metadata
   - обновляет SavedFilter.lastRunAt, lastCursor, lastResultCount
3. Добавь manual run action для одного SavedFilter из UI/admin button, если это не ломает scope:
   - auth
   - ownership
   - typed ActionResult
4. Добавь payloadHash computation на стороне Next.js по normalized sourcePayload.
5. Добавь document dedupe:
   - externalDocumentId если есть
   - иначе sourceHash/fileUrl/title fallback.
6. Добавь logs/safe summary response:
   - filtersProcessed
   - tendersCreated
   - tendersUpdated
   - documentsUpserted
   - errorsCount

Жесткие ограничения:
- Не пиши в БД из FastAPI.
- Не делай AI extraction.
- Не делай alerts.
- Не делай scoring.
- Не меняй kanbanStage автоматически при изменении source.
- Не возвращай raw sourcePayload целиком из cron response.

Acceptance criteria:
- Missing/wrong CRON_SECRET возвращает 401/403.
- Повторный запуск не создает дубли Tender/Document.
- New tender появляется в list/card.
- Existing tender обновляет payloadHash/updatedFromSourceAt при изменении sourcePayload.
- SavedFilter lastRunAt/lastResultCount обновляются.
- Manual run, если сделан, проверяет ownership.

После реализации верни:
- route/action summary;
- upsert keys;
- commands/tests run;
- demo path для проверки.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 09.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только cron route, FastAPI client, Prisma upsert logic, action и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Cron route требует CRON_SECRET.
2. Есть lock/mutual exclusion или явно безопасная защита от параллельного запуска.
3. Upsert ключ Tender: userId + externalPurchaseId + lotNumber.
4. Повторный запуск не создает дубли.
5. Document dedupe работает.
6. SavedFilter lastRunAt/lastCursor/lastResultCount обновляются.
7. FastAPI остается read-only compute service.
8. kanbanStage не меняется автоматически.
9. Cron response не раскрывает raw payload/secrets.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий повторного запуска cron.
```

## Daily result log

```md
# 2026-06-04

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать watchlist cron/upsert pipeline.

## Done
-

## Checks
-

## Evidence
- Unauthorized cron:
- First run summary:
- Second run duplicate check:
- Tenders list/card:

## Decisions
-

## Blockers
-

## Next day input
Day 10 должен закрыть sourceStage derivation, source freshness и контрольную выборку 20 закупок.
```
