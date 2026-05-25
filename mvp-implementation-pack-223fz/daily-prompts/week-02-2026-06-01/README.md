# Daily prompts: Week 02, 2026-06-01 to 2026-06-05

Эта папка содержит готовые ежедневные задачи-промпты для второй недели реализации MVP. Неделя соответствует `sprints/sprint-02-source-integration.md`: подключение реального источника 223-ФЗ и нормализованная карточка из live/fixture-compatible данных.

## Исходное состояние после Sprint 01

Считаем, что Sprint 01 завершен и зафиксирован:

- есть `apps/web` и `apps/api`;
- local Postgres работает;
- Prisma schema, migrations и seed default `KanbanStage` есть;
- Auth.js/dev auth работает;
- есть CRUD `SavedFilter`;
- есть mock tenders, список закупок и read-only tender card;
- `sourceStage` и `kanbanStage` уже отображаются отдельно;
- health endpoints работают.

## Недельная цель

К пятнице, 2026-06-05, система должна подтягивать закупки через FastAPI provider adapter, нормализовать их в DTO, upsert-ить `Tender` и `Document` через Next.js/Prisma, выводить source stage и source freshness, а также пройти контрольную проверку на 20 закупках или на live-shaped fixture dataset, если внешний API key пока недоступен.

## Важно про экономию токенов

Daily prompt уже содержит нужный статичный контекст. Не просите агента заново читать `deep-research-report.md`, sprint-файлы и весь `mvp-implementation-pack-223fz`.

Агент должен:

- принять prompt как источник истины;
- читать только релевантный код;
- открывать статичные документы только при противоречии или явной просьбе;
- не делать широкий обход всего репозитория без необходимости.

## Файлы недели

- `day-06-2026-06-01-provider-abstraction.md`
- `day-07-2026-06-02-eis223-search.md`
- `day-08-2026-06-03-normalize-dto.md`
- `day-09-2026-06-04-watchlist-cron-upsert.md`
- `day-10-2026-06-05-source-stage-control-sample.md`

## Правило фиксации

Каждый день должен закончиться одним статусом:

- `DONE`: задача работает, проверки запущены, результат записан.
- `PARTIAL`: часть работает, известен список недоделок.
- `BLOCKED`: есть конкретный блокер и следующий шаг.

