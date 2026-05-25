# AI agent workflow

## Как работать с агентами

Запускайте агентов маленькими партиями. Один агент - одна зона ответственности - один PR/patch. Не просите одного агента одновременно проектировать БД, UI, FastAPI, AI и деплой.

## Экономия контекста

Статичные материалы проекта уже упакованы в `daily-prompts`. Не просите агента каждый раз читать `deep-research-report.md`, `README.md`, архитектуру и sprint-файлы через shell. Это тратит команды, токены и часто приводит к sandbox-эскалациям.

Правильный режим:

- daily prompt содержит compact static context и acceptance criteria;
- агент читает только кодовую базу, которую реально меняет;
- markdown-документы открываются только при противоречии, неполном prompt или явной просьбе пользователя;
- QA-агент проверяет результат по daily prompt, а не перечитывает весь пакет.

Используйте `prompts/00-context-economy-rules.md` как источник этого правила для будущих недель.

## Координация запущенных процессов

Перед запуском dev server, FastAPI, Docker Compose, Prisma Studio, Storybook или любого watcher агент обязан проверить `.agent-state/runtime-status.json`.

Если сервис уже запущен и отвечает, агент использует существующий URL. Если не отвечает, агент помечает сервис как `stale` и только потом запускает новый. После запуска или остановки агент обновляет `.agent-state/runtime-status.json` и при необходимости `.agent-state/handoff.md`.

Короткое правило для вставки в задачи:

```text
Перед запуском любого сервера проверь .agent-state/runtime-status.json. Если нужный сервис уже running и URL отвечает, используй его. Не запускай второй сервер на новом порту без причины. После запуска/остановки обнови runtime-status.json.
```

## Базовый цикл

1. Дать агенту один daily prompt из `daily-prompts/`.
2. Попросить агента принять встроенный static context без повторного чтения markdown-документов.
3. Попросить агента прочитать только существующий код, который относится к задаче.
4. Ограничить реализацию acceptance criteria текущего дня.
5. Попросить реализовать минимально достаточный patch.
6. Попросить запустить проверки.
7. Отдать результат QA-агенту.
8. Только после QA мерджить.

## Роли агентов

- Architect agent: следит за границами сервисов, DTO, схемой, рисками.
- Next.js agent: UI, Server Functions, Route Handlers, Prisma writes.
- FastAPI agent: external source adapter, normalization, document parsing, AI endpoints.
- QA agent: тесты, регрессии, acceptance, негативные сценарии.
- DevOps agent: env, Docker, migrations, deploy, cron, monitoring.
- Security reviewer: ownership, authz, secrets, file proxy, cron protection.

## Правила постановки задач

Хорошая задача:

- ссылается на конкретный sprint-файл;
- указывает touched areas;
- содержит acceptance criteria;
- содержит запреты;
- требует тесты;
- ограничивает scope.

Плохая задача:

- "сделай MVP целиком";
- "улучши архитектуру";
- "добавь AI";
- "подключи ЕИС как-нибудь".

## Prompt chaining

Рекомендуемая цепочка для каждой крупной задачи:

1. Architect: проверить границы и контракт.
2. Implementer: написать код.
3. QA: найти баги и недостающие тесты.
4. Implementer: исправить только найденное.
5. Release reviewer: проверить DoD.

## Stop conditions

Остановите агента и перепоставьте задачу, если он:

- пишет в PostgreSQL из FastAPI;
- смешивает `sourceStage` и `kanbanStage`;
- делает AI-summary без `source_spans`;
- добавляет ML scoring вместо rule-based v1;
- убирает ownership checks;
- пытается отправлять полные документы в Telegram/email;
- меняет scope текущего спринта.
