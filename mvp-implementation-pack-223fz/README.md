# Implementation pack: Operational Workspace for 223-FZ suppliers

Этот пакет превращает `deep-research-report.md` в набор рабочих документов для самостоятельной сборки MVP недельными спринтами с помощью AI-агентов.

Главная идея продукта: не строить "полную тендерную платформу", а дать поставщику управляемый операционный контур:

- найти релевантную закупку 223-ФЗ;
- нормализовать карточку и документы;
- принять explainable `bid / review / no-bid` решение;
- провести закупку через внутреннюю воронку;
- не пропустить изменения, разъяснения и дедлайны;
- сократить чтение документации через extractive AI-summary с `source_spans`.

## Как пользоваться

1. Прочитайте `00-product-brief.md`, чтобы зафиксировать границы MVP.
2. Перед кодом пройдите `checklists/preflight.md`.
3. Используйте `01-architecture-blueprint.md`, `02-data-model-and-prisma.md`, `03-api-contracts.md` как технический каркас.
4. Реализуйте проект строго по файлам в `sprints/`: один файл - одна неделя.
5. Для работы с нейросетевыми агентами используйте `07-agent-workflow.md` и промпты из `prompts/`.
6. Для ежедневного запуска агентов используйте готовые планы из `daily-prompts/`.
7. Перед выкладкой пройдите `06-release-runbook.md` и `checklists/release.md`.

## Экономия токенов при работе с агентами

Не заставляйте агента каждый день перечитывать весь пакет документов. Daily prompt должен быть самодостаточным: статичный контекст включается прямо в prompt, а markdown-документы остаются справочником на случай противоречий.

Правило для агентов: читать только фактический код репозитория, который нужен для изменения; не запускать команды для повторного чтения `deep-research-report.md` и `mvp-implementation-pack-223fz`, если контекст уже вставлен в задачу.

Готовые правила: `prompts/00-context-economy-rules.md`.

## Рекомендуемый порядок чтения

1. `00-product-brief.md`
2. `01-architecture-blueprint.md`
3. `02-data-model-and-prisma.md`
4. `03-api-contracts.md`
5. `04-ai-document-pipeline.md`
6. `05-security-compliance.md`
7. `sprints/sprint-01-skeleton.md`
8. `daily-prompts/week-01-2026-05-25/README.md`
9. `sprints/sprint-02-source-integration.md`
10. `daily-prompts/week-02-2026-06-01/README.md`
11. `sprints/sprint-03-operational-loop.md`
12. `sprints/sprint-04-ai-release.md`
13. `06-release-runbook.md`

## Непереговорные решения

- Next.js является единственным writer в PostgreSQL.
- FastAPI не пишет бизнес-состояние в БД, а возвращает только typed DTO.
- `Tender.sourceStage` и внутренний `KanbanStage` всегда разделены.
- AI-анализ строго extractive: факты без цитаты считаются непригодными для решения.
- `scoreTotal` и `scoreConfidence` - разные метрики.
- Внешний источник должен быть закрыт адаптером `EIS223Adapter`, чтобы пережить смену API, тарифов и лимитов.
- Для российских персональных данных primary DB планируется в российском контуре.

## Что считается релизным MVP

Пользователь создает watchlist, система подтягивает релевантные закупки 223-ФЗ, строит нормализованную карточку, объяснимо считает bid/no-bid score, ведет закупку через канбан и чек-лист, отправляет deadline/change alerts и показывает extractive AI-summary документации с source spans.
