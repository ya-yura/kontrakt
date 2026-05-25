# Day 02: 2026-05-26 - Prisma, Auth, seed stages

## Goal

Добавить модель данных MVP, миграции, Auth.js/dev auth и seed default `KanbanStage`, чтобы приложение получило устойчивую базу для пользовательских данных.

## Implementation prompt

```text
Ты senior Next.js/Prisma engineer. Сегодня Day 02 первой недели MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только фактический код/структуру репозитория, которые нужны для реализации.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Статичный контекст:
- Проект: MVP Operational Workspace для поставщика по 223-ФЗ.
- Next.js App Router - system of record и единственный writer в PostgreSQL через Prisma.
- FastAPI - stateless compute/adaptation service и не пишет бизнес-состояние в БД.
- Tender.sourceStage и внутренний KanbanStage всегда разделены.
- UI mutations в будущем: auth, Zod validation, ownership check, typed ActionResult, idempotent write, revalidatePath.
- Sprint 01: skeleton продукта и read-only loop без live source, AI и alerts.

Контекст:
Day 01 должен был создать apps/web, apps/api, docker-compose, .env.example и health endpoints. Коротко проверь только релевантные файлы/папки, которые нужны для Prisma/Auth, без широкого обхода всего репозитория.

Задача дня: Prisma + Auth + seed.

Сделай только это:
1. Добавь Prisma в apps/web или согласованное место проекта.
2. Добавь schema MVP из deep-research-report/implementation pack:
   - User, Account, Session, VerificationToken
   - SavedFilter
   - KanbanStage
   - Tender
   - Document
   - AIAnalysis
   - enums
3. Добавь рекомендуемую таблицу AlertDelivery, если это не ломает sprint scope.
4. Настрой DATABASE_URL и DIRECT_URL через env.
5. Создай первую миграцию.
6. Добавь Prisma client helper.
7. Добавь Auth.js или dev-auth strategy, достаточную для Sprint 01.
8. Добавь seed default KanbanStage:
   INBOX, QUALIFY, GO, PREPARE, SUBMITTED_EXTERNALLY, WON, LOST, ARCHIVED.
9. Добавь protected app shell, где видно текущего dev user.

Жесткие ограничения:
- Postgres пишет только Next.js/Prisma.
- FastAPI не должен знать о Prisma.
- Не делай SavedFilter UI сегодня.
- Не подключай реальный источник.
- Не делай AI.
- Не смешивай sourceStage и kanbanStage.

Acceptance criteria:
- Миграция проходит на чистой БД.
- Prisma client генерируется.
- Seed создает default stages.
- Можно открыть protected app shell как dev user.
- В схеме есть separate Tender.sourceStage и Tender.kanbanStageId.
- Нет реальных secrets.

После реализации:
- Запусти миграцию, seed, typecheck/test если доступны.
- Верни список файлов, команд, результатов и рисков.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 02.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только фактические файлы проекта и команды, нужные для верификации.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.
- Открывай дополнительные документы только если результат противоречит задаче.

Проверь:
1. Миграция проходит на пустой БД.
2. Prisma schema содержит все MVP-сущности.
3. Auth tables совместимы с Auth.js/dev auth.
4. Seed создает все 8 KanbanStage.
5. sourceStage и kanbanStage разделены.
6. FastAPI не пишет и не читает бизнес-БД через ORM.
7. Нет секретов в репозитории.

Ответ дай findings-first. Для каждого finding укажи риск и точную правку.
```

## Daily result log

```md
# 2026-05-26

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Добавить Prisma, Auth.js/dev auth и seed default KanbanStage.

## Done
-

## Checks
-

## Evidence
- Migration:
- Seed:
- Protected shell:

## Decisions
-

## Blockers
-

## Next day input
Day 03 должен начинаться с CRUD SavedFilter, Zod validation, ownership checks и watchlists page.
```
