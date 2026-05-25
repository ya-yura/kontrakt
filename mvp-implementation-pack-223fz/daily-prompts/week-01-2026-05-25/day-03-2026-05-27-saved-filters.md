# Day 03: 2026-05-27 - SavedFilter CRUD

## Goal

Реализовать первый настоящий пользовательский workflow: создание, редактирование и удаление watchlist rules через `SavedFilter`.

## Implementation prompt

```text
Ты senior Next.js engineer. Сегодня Day 03 первой недели MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только фактический код/структуру репозитория, которые нужны для реализации.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Статичный контекст:
- Проект: MVP Operational Workspace для поставщика по 223-ФЗ.
- Next.js App Router - system of record и единственный writer в PostgreSQL через Prisma.
- FastAPI не должен вызываться для SavedFilter CRUD.
- UI mutations должны делать auth, Zod validation, ownership check, typed ActionResult, idempotent write и revalidatePath.
- Tender.sourceStage и KanbanStage разделены, но сегодня работа только с SavedFilter.

Контекст:
Day 02 должен был добавить Prisma, Auth.js/dev auth, миграции и seed KanbanStage. Коротко проверь только релевантные файлы Prisma/Auth/actions/routes, без широкого обхода всего репозитория.

Задача дня: SavedFilter CRUD.

Сделай только это:
1. Создай Zod schemas для SavedFilter input:
   - name
   - searchQuery
   - includeKeywords
   - excludeKeywords
   - okpd2Prefixes
   - regionCodes
   - methodAllowList
   - customerInnAllowList
   - customerInnBlockList
   - minPrice
   - maxPrice
   - daysAhead
   - onlyWithSecurity
   - onlyForMsp
   - notifyOnNew
   - notifyOnChanges
2. Реализуй Server Functions:
   - createSavedFilter(input)
   - updateSavedFilter(input)
   - deleteSavedFilter(filterId)
3. Каждая Server Function обязана:
   - auth()
   - Zod validation
   - ownership check
   - typed ActionResult
   - idempotent/предсказуемая запись
   - revalidatePath()
4. Создай page `/watchlists` или app route по структуре проекта.
5. UI должен показывать список фильтров и форму создания/редактирования.
6. Добавь пустое состояние.
7. Добавь обработку validation errors.

Жесткие ограничения:
- Не делай реальный preview поиска сегодня.
- Не вызывай FastAPI.
- Не делай cron.
- Не добавляй AI.
- Не позволяй пользователю менять чужие фильтры.

Acceptance criteria:
- Пользователь создает SavedFilter.
- Пользователь редактирует SavedFilter.
- Пользователь удаляет SavedFilter.
- Дубликат name у одного userId обрабатывается понятной ошибкой.
- Пустой список показывает нормальный empty state.
- Все mutations возвращают typed ActionResult.

После реализации:
- Добавь tests для action schemas и ownership/duplicate behavior, если тестовый стек уже есть.
- Запусти typecheck/lint/test если доступны.
- Верни отчет.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 03.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только фактические файлы проекта и команды, нужные для верификации.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.
- Открывай дополнительные документы только если результат противоречит задаче.

Проверь:
1. Все SavedFilter mutations требуют auth.
2. Есть Zod validation.
3. Есть ownership check на update/delete.
4. Duplicate name не приводит к raw DB error в UI.
5. typed ActionResult соблюдается.
6. revalidatePath используется после изменений.
7. UI не вызывает FastAPI и не делает fake live search.

Ответ дай findings-first. Если блокеров нет, перечисли manual QA steps.
```

## Daily result log

```md
# 2026-05-27

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать SavedFilter CRUD.

## Done
-

## Checks
-

## Evidence
- Created filter:
- Updated filter:
- Duplicate validation:

## Decisions
-

## Blockers
-

## Next day input
Day 04 должен начинаться с mock EIS223Adapter, seed mock tenders и списка закупок.
```
