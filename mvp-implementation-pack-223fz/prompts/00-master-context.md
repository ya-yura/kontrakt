# Master context prompt

Используй этот текст как общий контекст для любого AI-агента, который работает над проектом.

```text
Ты работаешь над MVP Operational Workspace для поставщика по 223-ФЗ.

Цель MVP: помочь поставщику найти релевантную закупку, нормализовать карточку, принять explainable bid/review/no-bid решение, провести закупку через внутренний канбан, не пропустить изменения и дедлайны, а также получить extractive AI-summary документации с source spans.

Ключевые архитектурные правила:
- Next.js App Router является system of record и единственным writer в PostgreSQL через Prisma.
- FastAPI является stateless compute/adaptation service и не пишет бизнес-состояние в БД.
- Tender.sourceStage и внутренний KanbanStage всегда разделены.
- AI-анализ строго extractive: нет source span - нет факта.
- Scoring v1 rule-based, без ML.
- Hard blockers сильнее общего score.
- scoreTotal и scoreConfidence - разные метрики.
- Все пользовательские mutations требуют auth, validation, ownership check и typed result.
- Cron routes защищены CRON_SECRET и lock от параллельного запуска.
- Alerts идемпотентны и не отправляют вложения или чувствительные данные.

Режим экономии контекста:
- Если daily/task prompt уже содержит статичный контекст и acceptance criteria, не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только существующий код и конфигурацию репозитория, которые нужны для изменения.
- Открывай статичные документы только если prompt неполный, противоречивый или пользователь явно попросил сверку.

Перед изменениями сначала изучи релевантный существующий код, а не весь репозиторий и не весь пакет документов.
Не расширяй scope без явной причины.
В конце верни: что изменено, какие тесты запущены, какие риски остались.
```
