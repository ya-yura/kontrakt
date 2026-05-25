# Context economy rules

Используйте эти правила во всех будущих промптах агентам, чтобы не тратить токены и команды на повторное чтение статичных материалов.

## Главное правило

Ежедневный prompt должен быть самодостаточным. Агенту не нужно перечитывать `deep-research-report.md` и файлы `mvp-implementation-pack-223fz`, если нужный контекст уже включен в prompt.

## Что агенту делать сразу

1. Принять статичный контекст из prompt как источник истины.
2. Проверить `.agent-state/runtime-status.json` перед запуском долгоживущих процессов.
3. Читать только фактический код текущего репозитория, который нужен для изменения.
4. Выполнять только команды, необходимые для реализации и проверки.
5. Не запускать shell-команды для чтения статичных markdown-документов, если нет явного противоречия.

## Runtime coordination

Перед запуском dev server, FastAPI, Docker Compose, Prisma Studio, Storybook или watcher агент обязан проверить `.agent-state/runtime-status.json`.

Если нужный сервис уже `running` и URL отвечает, агент должен использовать его, а не запускать новый на другом порту.

Если URL не отвечает, агент помечает сервис как `stale` и только после этого запускает новый процесс и обновляет registry.

## Когда можно открыть статичные документы

Только если:

- prompt явно неполный;
- acceptance criteria противоречат друг другу;
- агент обнаружил расхождение между кодом и документами;
- пользователь прямо попросил свериться с конкретным документом.

## Compact static context для вставки в daily prompts

```text
Проект: MVP Operational Workspace для поставщика по 223-ФЗ.

Цель MVP: найти релевантную закупку, нормализовать карточку, принять explainable bid/review/no-bid решение, провести закупку через внутренний канбан, не пропустить изменения/дедлайны и получить extractive AI-summary документации с source spans.

Архитектурные инварианты:
- Next.js App Router является system of record и единственным writer в PostgreSQL через Prisma.
- FastAPI является stateless compute/adaptation service и не пишет бизнес-состояние в БД.
- Tender.sourceStage и внутренний KanbanStage всегда разделены.
- UI mutations идут через Server Functions: auth, Zod validation, ownership check, typed ActionResult, idempotent write, revalidatePath.
- Cron routes защищены CRON_SECRET и lock от параллельного запуска.
- AI-анализ строго extractive: нет source span - нет факта.
- Scoring v1 rule-based, hard blockers сильнее общего score.
- Alerts идемпотентны и не отправляют вложения или чувствительные данные.
```
