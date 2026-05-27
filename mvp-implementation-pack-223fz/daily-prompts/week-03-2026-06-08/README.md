# Daily prompts: Week 03, 2026-06-08 to 2026-06-12

Эта папка содержит готовые ежедневные задачи-промпты для третьей недели реализации MVP. Неделя соответствует `sprints/sprint-03-operational-loop.md`: канбан-воронка, чек-листы, explainable scoring и первые алерты.

## Исходное состояние после Sprint 02

Считаем, что Sprint 02 завершен и зафиксирован:

- FastAPI имеет provider abstraction, fixture/live mode, `/v1/eis223/search` и `/normalize`;
- Next.js cron `watchlists/run` подтягивает закупки через FastAPI;
- `Tender` и `Document` upsert идемпотентны;
- `RuntimeLock` lease защищает cron от параллельного запуска;
- document fallback dedupe hash выровнен;
- `sourceStage` выводится отдельно от `kanbanStage`;
- UI показывает source freshness;
- контрольная выборка или live-shaped fixture validation зафиксированы.

## Недельная цель

К пятнице, 2026-06-12, пользователь должен уметь взять закупку в работу, двигать ее по внутренней воронке, вести чек-лист, получить rule-based `bid/review/no-bid` score с объяснением и получать первые `new_match`/deadline alerts без дублей.

## Важно про экономию токенов

Daily prompt уже содержит нужный статичный контекст. Не просите агента заново читать `deep-research-report.md`, sprint-файлы и весь `mvp-implementation-pack-223fz`.

Агент должен:

- принять prompt как источник истины;
- читать только релевантный код;
- перед запуском серверов проверять `.agent-state/runtime-status.json`;
- использовать уже запущенный URL, если сервис отвечает;
- открывать статичные документы только при противоречии или явной просьбе.

## Файлы недели

- `day-11-2026-06-08-kanban-board.md`
- `day-12-2026-06-09-checklists-comments.md`
- `day-13-2026-06-10-scoring-engine.md`
- `day-14-2026-06-11-alert-engine-idempotency.md`
- `day-15-2026-06-12-alert-adapters-weekly-demo.md`

## Правило фиксации

Каждый день должен закончиться одним статусом:

- `DONE`: задача работает, проверки запущены, результат записан.
- `PARTIAL`: часть работает, известен список недоделок.
- `BLOCKED`: есть конкретный блокер и следующий шаг.

