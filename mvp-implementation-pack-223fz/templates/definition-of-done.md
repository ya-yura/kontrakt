# Definition of done

Задача считается готовой, если выполнены все применимые пункты.

## Product

- Поведение соответствует sprint acceptance criteria.
- Empty states и error states не ломают пользовательский путь.
- Пользователь видит честный статус данных: mock/live, stale/fresh, pending/failed/completed.

## Engineering

- Код следует существующим patterns проекта.
- Scope не расширен без необходимости.
- Next.js остается единственным DB writer.
- FastAPI не хранит бизнес-состояние.
- DTO валидируются на границе.
- Повторный запуск batch/cron безопасен.

## Security

- Есть auth.
- Есть ownership check.
- Нет утечки secrets.
- File/cron/webhook routes защищены.
- Alerts не отправляют чувствительные данные.

## AI

- AI output валидируется схемой.
- Нет фактов без source spans.
- Unknown information попадает в `unknowns`.
- Ошибка AI не ломает карточку.

## Tests

- Добавлены или обновлены тесты.
- Happy path покрыт.
- Минимум один negative path покрыт.
- Проверки запущены локально или явно объяснено, почему не запущены.

## Handoff

- В PR/отчете указано, что изменено.
- Указаны тесты.
- Указаны остаточные риски.
- Указаны manual QA шаги, если они нужны.

