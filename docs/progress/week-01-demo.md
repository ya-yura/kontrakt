# Week 01 demo notes

## Что работает

- Dev login через текущего пользователя `dev.supplier@example.local`.
- Protected shell: `/` показывает рабочий контур Next.js + Prisma и Kanban stages.
- Watchlists: `/watchlists` поддерживает read-only/create/edit/delete saved filters для dev user.
- Tenders list: `/tenders` показывает mock EIS 223-ФЗ закупки, сортировку, sourceStage, KanbanStage и decision отдельно.
- Tender card: `/tenders/[id]` открывает owner-scoped read-only карточку закупки.
- Карточка показывает header, economics, timeline, requirements, documents, changes feed и честный AI empty state.
- Quick actions `Rescore`, `Run AI`, `Move stage` видны как недоступные placeholders.
- `sourceStage` и внутренний `KanbanStage` разведены в UI и модели.

## Что не входит

- Реальный EIS/source integration.
- Scoring engine и пересчет score.
- AI-анализ, summary, рекомендации или автоматические выводы.
- Kanban movement и server actions для смены стадии.
- Alerts, delivery и мониторинг изменений live source.
- Production auth/RBAC beyond текущего dev auth контура.

## Как проверить

1. Поднять PostgreSQL: `npm run docker:up`.
2. В `apps/web` настроить `DATABASE_URL` или `DIRECT_URL`.
3. Применить миграции: `npm run db:migrate -w apps/web`.
4. Заполнить mock data: `npm run db:seed -w apps/web`.
5. Запустить web: `npm run dev -w apps/web`.
6. Открыть `/`, затем `/watchlists`, затем `/tenders`.
7. В списке открыть любой номер закупки.
8. Проверить, что карточка показывает mock data, отдельные `sourceStage` и `KanbanStage`, документы и AI empty state.

## Риски перед Sprint 02

- Нужно заменить dev auth на production-ready ownership/RBAC до совместной работы нескольких пользователей.
- Нужно определить контракт live source adapter: какие поля обязательны, какие остаются nullable, как фиксировать changes feed.
- Нужно спроектировать scoring отдельно от sourceStage/KanbanStage, чтобы не смешать внешний статус и внутреннее решение.
- Нужно ввести явные состояния AI analysis перед запуском провайдера: not started, queued, running, failed, stale.
- Нужно решить, где хранить и как версионировать документы после подключения реального источника.

## Sprint 01 DoD

Read-only loop в целом готов для weekly demo: dev user проходит `/` -> `/watchlists` -> `/tenders` -> `/tenders/[id]` без live source, AI и alerts. Недоделки намеренные и вынесены в Sprint 02: real source sync, scoring, AI execution, alerts и Kanban mutations.
