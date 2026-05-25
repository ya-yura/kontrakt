# Day 04: 2026-05-28 - Mock tenders and list page

## Goal

Добавить mock tender dataset и список закупок, чтобы пользователь увидел первые операционные данные без реального внешнего источника.

## Implementation prompt

```text
Ты senior Next.js/Product engineer. Сегодня Day 04 первой недели MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только фактический код/структуру репозитория, которые нужны для реализации.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Статичный контекст:
- Проект: MVP Operational Workspace для поставщика по 223-ФЗ.
- MVP помогает найти закупку, открыть нормализованную карточку, принять bid/review/no-bid, вести канбан и позже получать alerts/AI-summary.
- Next.js App Router - system of record и единственный writer в PostgreSQL через Prisma.
- Sprint 01 использует mock/fixture data, не live source.
- Tender.sourceStage и внутренний KanbanStage всегда отображаются отдельно.

Контекст:
Day 03 должен был добавить SavedFilter CRUD. Коротко проверь только релевантные файлы SavedFilter, Prisma seed и app routes, без широкого обхода всего репозитория.

Задача дня: mock tender data + tenders list.

Сделай только это:
1. Создай mock/fixture adapter `EIS223Adapter` или аналогичный слой, который возвращает нормализованные 223-ФЗ закупки из local fixture.
2. Добавь seed 5 mock tenders для текущего dev user:
   - разные дедлайны
   - разные цены
   - разные customerInn/customerName
   - разные sourceStage
   - 2-3 mock documents на часть закупок
3. Создай страницу списка закупок `/tenders`.
4. В списке показать:
   - номер/registryNumber
   - title
   - customer
   - maxPrice
   - applicationDeadlineAt
   - sourceStage
   - kanbanStage
   - decision
   - score placeholder
5. Добавь сортировку или query params минимум по deadline и price, если это не раздувает scope.
6. Добавь empty state.
7. Добавь ссылку на будущую карточку `/tenders/[id]`, даже если детальная страница появится завтра.

Жесткие ограничения:
- Это fixture/mock mode, не реальный внешний API.
- Не делай FastAPI source integration.
- Не делай scoring engine.
- Не делай AI.
- Не смешивай sourceStage и kanbanStage.
- Не делай kanban board сегодня.

Acceptance criteria:
- После seed пользователь видит 5 закупок.
- Список читаемый и пригоден для ежедневной работы.
- sourceStage и kanbanStage показаны отдельными колонками/badges.
- Пустой список не выглядит как ошибка.
- Mock adapter изолирован так, чтобы Sprint 02 мог заменить его live adapter.

После реализации:
- Запусти seed и проверки.
- Верни отчет с тестовыми закупками и URL списка.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 04.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только фактические файлы проекта и команды, нужные для верификации.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.
- Открывай дополнительные документы только если результат противоречит задаче.

Проверь:
1. Seed создает 5 mock tenders для правильного userId.
2. Список не показывает чужие тендеры.
3. sourceStage и kanbanStage визуально и технически разделены.
4. Mock adapter не завязан намертво на UI.
5. Empty state есть.
6. Нет fake AI/scoring/live source claims.
7. Ссылки на карточки корректны.

Ответ дай findings-first. Если блокеров нет, дай список ручных проверок для браузера.
```

## Daily result log

```md
# 2026-05-28

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Добавить mock tenders и список закупок.

## Done
-

## Checks
-

## Evidence
- Seed result:
- Tenders list URL:
- Screenshot:

## Decisions
-

## Blockers
-

## Next day input
Day 05 должен начинаться с read-only tender card и недельного demo checkpoint.
```
