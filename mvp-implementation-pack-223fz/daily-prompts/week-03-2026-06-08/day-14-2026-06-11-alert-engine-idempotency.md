# Day 14: 2026-06-11 - Alert engine and idempotency

## Goal

Реализовать ядро алертов без реальной отправки: `AlertDelivery`, генерация `new_match` и deadline events, idempotency keys, cron route `alerts/run`.

## Implementation prompt

```text
Ты senior backend engineer. Сегодня Day 14 Sprint 03 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web alerts, Prisma schema/migrations, cron routes, Tender/SavedFilter models и tests.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- RuntimeLock lease для watchlists/run уже есть.
- Tenders имеют deadlines, lastSeenAt, source freshness.
- SavedFilter имеет notifyOnNew/notifyOnChanges.
- AlertDelivery может уже быть в schema; если нет, добавь миграцию.

Задача дня: alert engine core.

Сделай только это:
1. Убедись, что есть Prisma model `AlertDelivery` или добавь его:
   - userId
   - tenderId
   - channel: EMAIL|TELEGRAM
   - type: NEW_MATCH|DEADLINE_T48|DEADLINE_T24|DEADLINE_T2|NEW_CHANGE|NEW_CLARIFICATION|STAGE_SLA_BREACH
   - idempotencyKey unique
   - payload JSONB
   - sentAt nullable
   - acknowledgedAt nullable
   - errorMessage nullable
2. Реализуй alert event generation:
   - `new_match` for recently created/first seen tenders where filter notifyOnNew is true
   - `deadline_t48`
   - `deadline_t24`
   - `deadline_t2`
3. Реализуй stable idempotency key:
   - userId:tenderId:type:channel:deadlineBucket или аналогично
4. Реализуй dry-run/in-memory/mock delivery adapter:
   - не отправляет реальные email/Telegram
   - пишет AlertDelivery как факт/попытку
5. Реализуй `POST /api/cron/alerts/run`:
   - Authorization: Bearer CRON_SECRET
   - RuntimeLock или аналогичный lease для `alerts.run`
   - safe summary response
6. Добавь `acknowledgeAlert(tenderId, channel, type)` или отдельную action, если легко встроить.
7. UI:
   - tender card показывает alert history
   - профиль/настройки можно не делать сегодня
8. Добавь tests:
   - idempotency duplicate skip
   - t48/t24/t2 windows
   - unauthorized cron
   - safe summary no raw payload/secrets
   - acknowledge ownership, если action добавлена.

Жесткие ограничения:
- Не отправлять реальные Telegram/email сегодня.
- Не отправлять PDF/полные документы/чувствительные данные.
- Не делать AI.
- Не делать change/clarification deep diff сегодня.
- Не ломать watchlists/run RuntimeLock.

Acceptance criteria:
- alerts/run создает AlertDelivery records без дублей.
- Повторный запуск не дублирует алерты.
- Deadline buckets работают.
- Cron route защищен.
- Tender card показывает историю алертов.

После реализации верни:
- alert types implemented;
- idempotency key format;
- tests/checks run;
- что осталось для реальных adapters Day 15.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 14.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только AlertDelivery, alert engine, cron route, UI history и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. AlertDelivery has unique idempotencyKey.
2. alerts/run requires CRON_SECRET.
3. Duplicate run does not duplicate alerts.
4. Deadline buckets t48/t24/t2 are deterministic.
5. Safe summary has no raw payload/secrets.
6. Mock delivery does not send real messages.
7. Alert history is ownership-safe.
8. No AI/change diff/real adapters outside scope.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий duplicate alert run.
```

## Daily result log

```md
# 2026-06-11

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать alert engine core и idempotency.

## Done
-

## Checks
-

## Evidence
- First alerts/run:
- Second alerts/run duplicate skip:
- Alert history:

## Decisions
-

## Blockers
-

## Next day input
Day 15 должен добавить Telegram/email adapters, weekly demo и Sprint 03 acceptance check.
```

