# Sprint 01: Product skeleton and read-only loop

## Цель недели

Поднять skeleton продукта и получить read-only операционный контур без реального внешнего источника, AI и cron.

## Инкремент

Пользователь может войти, создать фильтр, увидеть список найденных моковых тендеров и открыть нормализованную карточку.

## Scope

- Next.js App Router skeleton.
- Auth.js.
- Prisma schema and migrations.
- Seed default `KanbanStage`.
- CRUD `SavedFilter`.
- Watchlists page.
- Tenders list page.
- Read-only tender detail page from mock data.
- Mock provider adapter.
- Health endpoints for web and api.
- FastAPI skeleton with `/healthz`, `/docs`, `/openapi.json`.

## Out of scope

- реальный внешний источник;
- document download;
- OCR;
- LLM;
- Telegram/email;
- full kanban drag-and-drop;
- production deploy.

## Tasks

### 1. Repository setup

- Создать monorepo layout `apps/web`, `apps/api`.
- Добавить package scripts для web lint/typecheck/test.
- Добавить Python project config для FastAPI.
- Добавить Docker Compose для local Postgres.
- Добавить `.env.example`.

Acceptance:

- `apps/web` запускается локально;
- `apps/api` запускается локально;
- Postgres доступен;
- health endpoints отвечают.

### 2. Prisma and auth

- Добавить Prisma schema из отчета.
- Добавить Auth.js tables.
- Добавить seed default kanban stages.
- Добавить тестового пользователя/dev login strategy.

Acceptance:

- миграции проходят на чистой БД;
- после seed есть default stages;
- пользователь может открыть protected app shell.

### 3. SavedFilter CRUD

- Zod schemas.
- Server Functions: create/update/delete.
- Watchlists page with list and edit form.
- Basic validation and ownership.

Acceptance:

- можно создать, обновить и удалить фильтр;
- нельзя создать дубликат имени у одного пользователя;
- ошибки формы typed, без raw exceptions.

### 4. Mock tender data

- Mock `EIS223Adapter`.
- Seed 5 tenders with documents.
- Tenders list with sorting by deadline, price, score placeholder.
- Tender card read-only sections: Header, Economics, Timeline, Requirements, Documents, Changes, AI placeholder.

Acceptance:

- пользователь видит список;
- открывает карточку;
- source stage и kanban stage отображаются отдельно;
- AI empty state честно говорит, что анализа еще нет.

## Tests

- Prisma seed smoke test.
- SavedFilter action tests.
- Tender list render test.
- Tender detail ownership test.
- FastAPI health test.

## Definition of done

- Один пользователь полностью проходит onboarding.
- Создается хотя бы один `SavedFilter`.
- Список тендеров и карточка работают без AI и cron.
- Все проверки из `templates/definition-of-done.md` выполнены.

