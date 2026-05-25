# Release runbook

## Цель релиза

Выкатить MVP, которым можно пользоваться на пилотных поставщиках: watchlists, реальные закупки, карточки, scoring, kanban, alerts и AI-summary.

## Environments

Минимум:

- local dev;
- staging;
- production.

Staging должен иметь отдельную БД, отдельные secrets, отдельный Telegram bot или отключенные реальные уведомления.

## Pre-release steps

1. Зафиксировать freeze scope: только багфиксы и release blockers.
2. Прогнать миграции на staging.
3. Запустить seed или demo dataset.
4. Проверить auth flow.
5. Проверить watchlist manual run.
6. Проверить cron auth.
7. Проверить FastAPI `/healthz`, `/docs`, `/openapi.json`.
8. Проверить 20 реальных закупок из контрольной выборки.
9. Проверить AI на 10-15 документах.
10. Проверить deadline alerts без дублей.
11. Проверить file proxy access control.
12. Проверить empty/error states UI.

## Production deploy sequence

1. Deploy FastAPI.
2. Проверить `GET /healthz`.
3. Deploy Next.js без включенных cron schedule.
4. Применить Prisma migrations.
5. Запустить seed default kanban stages.
6. Проверить login.
7. Проверить ручной watchlist run на одном пользователе.
8. Включить cron schedule.
9. Включить alerts сначала в digest/test mode.
10. Перевести alerts в production mode.

## Rollback

Rollback должен быть простым:

- отключить cron schedule;
- отключить alert adapters;
- откатить Next.js deployment;
- откатить FastAPI deployment;
- DB migration rollback делать только при наличии проверенного down plan.

Если миграция необратимая, rollback через feature flags и hotfix, а не через удаление данных.

## Post-release monitoring

Первые 48 часов смотреть:

- ошибки cron;
- длительность watchlist run;
- количество duplicate skips;
- FastAPI upstream failures;
- AI failures;
- OCR queue;
- alert sent/failed;
- жалобы на неверный дедлайн;
- жалобы на source freshness.

## Pilot acceptance

Пилот можно считать начатым, когда:

- один пользователь создал watchlist;
- система нашла реальные закупки;
- хотя бы одна закупка прошла `INBOX -> QUALIFY -> GO`;
- пользователь получил хотя бы один deadline alert;
- пользователь увидел AI-summary с source spans;
- есть понятный путь сообщить о неверном извлечении или баге.

