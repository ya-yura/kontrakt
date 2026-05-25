# Day 05: 2026-05-29 - Read-only tender card and weekly demo

## Goal

Собрать read-only карточку закупки и закрыть неделю демонстрируемым пользовательским loop: login -> watchlist -> tenders list -> tender card.

## Implementation prompt

```text
Ты senior product-minded Next.js engineer. Сегодня Day 05 первой недели MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только фактический код/структуру репозитория, которые нужны для реализации.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Статичный контекст:
- Проект: MVP Operational Workspace для поставщика по 223-ФЗ.
- Цель Sprint 01: пользователь проходит read-only loop без live source, AI и alerts.
- Next.js App Router - system of record и единственный writer в PostgreSQL через Prisma.
- Tender.sourceStage и внутренний KanbanStage всегда разделены.
- AI в Sprint 01 только honest empty state, без fake summary.

Контекст:
Day 04 должен был добавить mock tenders и список. Коротко проверь только релевантные файлы tenders list, mock seed/adapter и app routes, без широкого обхода всего репозитория.

Задача дня: read-only tender card + weekly demo readiness.

Сделай только это:
1. Реализуй страницу `/tenders/[id]`.
2. Страница должна проверять ownership.
3. Собери read-only sections:
   - Header: номер, title, customer, price, deadline countdown, decision badge, score placeholder
   - Economics: maxPrice, security amounts, payment terms
   - Timeline: applicationStartAt, applicationDeadlineAt, clarificationDeadlineAt, resultAt, publishedAt
   - Requirements: participationRequirements, requiredDocuments, evaluationCriteria placeholders/data
   - Documents: список документов, type, fileName/title, status
   - Changes: changesFeed или empty state
   - AI: честный empty state "AI-анализ еще не запускался"
4. Покажи sourceStage и kanbanStage отдельно.
5. Добавь quick actions placeholders disabled или clearly unavailable:
   - Rescore
   - Run AI
   - Move stage
6. Добавь loading/error/not found states.
7. Подготовь weekly demo notes в docs/progress/week-01-demo.md:
   - что работает
   - что не входит
   - как проверить
   - риски перед Sprint 02

Жесткие ограничения:
- Не реализуй scoring engine сегодня.
- Не запускай AI.
- Не делай реальный source integration.
- Не делай kanban movement.
- Не показывай AI как готовый результат.

Acceptance criteria:
- Пользователь проходит путь: login -> watchlists -> tenders -> tender card.
- Карточка открывается только владельцу.
- Карточка показывает нормализованные данные mock tender.
- AI empty state честный.
- sourceStage и kanbanStage разделены.
- Есть weekly demo notes.
- Sprint 01 Definition of Done в целом выполнен или явно перечислены недоделки.

После реализации:
- Запусти доступные проверки.
- Сделай итоговый отчет по Sprint 01:
  - DONE/PARTIAL/BLOCKED
  - demo path
  - commands run
  - blockers
  - recommended first task for Sprint 02
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 05 и готовность Sprint 01.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только фактические файлы проекта и команды, нужные для верификации.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.
- Открывай дополнительные документы только если результат противоречит задаче.

Проверь:
1. Demo path login -> watchlists -> tenders -> tender card.
2. Ownership tender card.
3. Разделы карточки.
4. sourceStage и kanbanStage разделены.
5. AI empty state не симулирует анализ.
6. Quick actions не выглядят рабочими, если еще не реализованы.
7. Есть weekly demo notes.
8. Sprint 01 acceptance criteria выполнены.

Ответ:
- Findings first.
- Затем Sprint 01 status: DONE/PARTIAL/BLOCKED.
- Затем список must-fix перед Sprint 02.
```

## Daily result log

```md
# 2026-05-29

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Собрать read-only tender card и weekly demo.

## Done
-

## Checks
-

## Evidence
- Demo path:
- Tender card URL:
- Screenshot:
- Weekly demo notes:

## Decisions
-

## Blockers
-

## Sprint 01 result
DONE | PARTIAL | BLOCKED

## Sprint 02 first task
Создать FastAPI provider abstraction и fixture/live mode для EIS223Adapter.
```
