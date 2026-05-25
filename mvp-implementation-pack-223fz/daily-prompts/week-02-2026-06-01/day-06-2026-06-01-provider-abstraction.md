# Day 06: 2026-06-01 - Provider abstraction and FastAPI integration foundation

## Goal

Подготовить FastAPI-слой для подключения внешнего источника 223-ФЗ: provider abstraction, настройки, fixture/live режимы, Pydantic-схемы и typed errors. Сегодня еще не пишем в БД и не запускаем Next cron.

## Implementation prompt

```text
Ты senior Python/FastAPI engineer. Сегодня Day 06, первый день Sprint 02 MVP Operational Workspace для поставщика по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/api, env/config и, при необходимости, существующий fastapi client в apps/web.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Sprint 01 завершен: есть apps/web, apps/api, Postgres, Prisma/Auth, SavedFilter CRUD, mock tenders list и read-only tender card.
- Next.js является единственным writer в PostgreSQL через Prisma.
- FastAPI является stateless compute/adaptation service и не пишет бизнес-состояние в БД.
- Tender.sourceStage и внутренний KanbanStage всегда разделены.

Задача дня: foundation для внешнего источника 223-ФЗ.

Сделай только это:
1. В apps/api создай provider abstraction:
   - интерфейс/протокол EIS223Provider;
   - fixture provider;
   - live provider shell для внешнего API, если есть env для base URL/API key.
2. Добавь настройки через env:
   - EIS_PROVIDER_MODE=fixture|live
   - EIS_PROVIDER_BASE_URL
   - EIS_PROVIDER_API_KEY
   - EIS_PROVIDER_TIMEOUT_SECONDS
3. Добавь Pydantic-схемы:
   - SavedFilterExecutionRequest
   - NormalizedTenderHit
   - ProviderErrorResponse или typed exception mapping
4. Добавь local fixture dataset для 223-ФЗ закупок, похожий на live payload.
5. Добавь typed errors:
   - upstream_unavailable
   - upstream_rate_limited
   - invalid_provider_response
   - provider_not_configured
6. Обнови /healthz так, чтобы он показывал provider mode без раскрытия секретов.
7. Добавь unit tests для fixture provider и settings.

Жесткие ограничения:
- FastAPI не пишет в PostgreSQL.
- Не реализуй Next.js cron сегодня.
- Не делай AI, OCR, alerts.
- Не выдавай fixture mode за live integration.
- Не логируй API key.

Acceptance criteria:
- FastAPI запускается в fixture mode без внешнего API key.
- Live mode при отсутствии обязательных env возвращает понятную ошибку provider_not_configured.
- Fixture provider возвращает predictable list of tender hits.
- /healthz не раскрывает секреты.
- Tests проходят или четко описано, почему не запущены.

После реализации верни:
- измененные файлы;
- какие env добавлены;
- как включить fixture/live mode;
- какие тесты запущены;
- blockers для Day 07.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 06.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только релевантные файлы apps/api, env examples и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Provider abstraction существует и не смешан с бизнес-БД.
2. Fixture mode работает без API key.
3. Live mode не падает raw traceback при отсутствии env.
4. /healthz не раскрывает секреты.
5. Typed errors понятны клиенту.
6. Нет записи в PostgreSQL из FastAPI.
7. Нет лишнего scope: cron, AI, alerts, scoring.

Ответ дай findings-first. Если блокеров нет, скажи "Блокеров Day 06 не вижу" и перечисли остаточные риски.
```

## Daily result log

```md
# 2026-06-01

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Подготовить FastAPI provider abstraction и fixture/live режимы.

## Done
-

## Checks
-

## Evidence
- API health:
- Fixture provider:
- Live mode behavior without key:

## Decisions
-

## Blockers
-

## Next day input
Day 07 должен реализовать POST /v1/eis223/search поверх provider abstraction.
```
