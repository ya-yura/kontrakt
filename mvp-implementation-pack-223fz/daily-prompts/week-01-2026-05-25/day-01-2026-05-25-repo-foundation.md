# Day 01: 2026-05-25 - Repository foundation

## Goal

Создать технический фундамент проекта: структуру монорепозитория, минимальные приложения `apps/web` и `apps/api`, local Postgres, `.env.example`, health endpoints и базовые команды запуска.

## Implementation prompt

```text
Ты senior full-stack engineer. Сегодня Day 01 первой недели MVP Operational Workspace для поставщика по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только фактический код/структуру репозитория, которые нужны для реализации.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Статичный контекст:
- Проект: MVP Operational Workspace для поставщика по 223-ФЗ.
- Цель MVP: watchlist закупок, нормализованная карточка, bid/review/no-bid, внутренний канбан, алерты и extractive AI-summary с source spans.
- Next.js App Router - system of record и единственный writer в PostgreSQL через Prisma.
- FastAPI - stateless compute/adaptation service, без записи бизнес-состояния в БД.
- Tender.sourceStage и внутренний KanbanStage всегда разделены.
- Sprint 01: skeleton продукта и read-only loop без live source, AI и alerts.

Задача дня: создать foundation монорепозитория.

Сделай только это:
1. Создай структуру:
   - apps/web
   - apps/api
   - docs/progress
2. Подними минимальный Next.js App Router проект в apps/web.
3. Подними минимальный FastAPI проект в apps/api.
4. Добавь local Postgres через docker-compose.
5. Добавь .env.example со всеми переменными из security/compliance, но без реальных секретов.
6. Добавь health endpoints:
   - apps/web: GET /api/healthz
   - apps/api: GET /healthz
7. Добавь README/команды запуска для local dev.
8. Настрой минимальные scripts для install/dev/build/typecheck/test там, где это уместно.

Жесткие ограничения:
- Не подключай реальный внешний источник.
- Не делай Prisma schema сегодня, только подготовь место.
- Не добавляй AI, OCR, Telegram, email.
- Не коммить реальные secrets.
- Не расширяй scope.

Acceptance criteria:
- apps/web запускается локально.
- apps/api запускается локально.
- docker-compose поднимает Postgres.
- /api/healthz и /healthz возвращают OK/healthy JSON.
- .env.example полный и безопасный.
- В docs/progress есть шаблон дневной фиксации.

После реализации:
- Запусти доступные проверки.
- Верни отчет: измененные файлы, команды, результат, что осталось.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 01.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только фактические файлы проекта и команды, нужные для верификации.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.
- Открывай дополнительные документы только если результат противоречит задаче.

Проверь:
1. Есть ли apps/web и apps/api.
2. Запускаются ли оба приложения.
3. Работают ли health endpoints.
4. Есть ли local Postgres в docker-compose.
5. Нет ли реальных секретов в .env.example.
6. Не добавлен ли лишний scope: Prisma/Auth/AI/source integration.
7. Есть ли понятные команды запуска.

Ответ дай findings-first. Если блокеров нет, скажи "Блокеров Day 01 не вижу" и перечисли остаточные риски.
```

## Daily result log

```md
# 2026-05-25

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Создать foundation монорепозитория.

## Done
-

## Checks
-

## Evidence
- Web health:
- API health:
- Screenshot/terminal output:

## Decisions
-

## Blockers
-

## Next day input
Day 02 должен начинаться с Prisma schema, migrations, Auth.js/dev auth и seed KanbanStage.
```
