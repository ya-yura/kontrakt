# Day 08: 2026-06-03 - Normalize endpoint and DTO contract

## Goal

Реализовать нормализацию одной закупки: `POST /v1/eis223/purchase/{externalPurchaseId}/normalize`, Pydantic DTO, mapping document metadata и Next.js-side validation/mapping без записи в БД.

## Implementation prompt

```text
Ты senior integration engineer. Сегодня Day 08 Sprint 02 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/api normalize/provider/schemas/tests и apps/web fastapi client/validators, если они уже есть.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 07 должен был реализовать POST /v1/eis223/search.
- Next.js пишет в PostgreSQL, FastAPI только возвращает DTO.
- В Sprint 01 уже есть Prisma Tender/Document и read-only tender card.

Задача дня: normalize DTO contract.

Сделай только это:
1. Реализуй FastAPI endpoint:
   `POST /v1/eis223/purchase/{externalPurchaseId}/normalize`
2. Endpoint принимает:
   - externalPurchaseId в path
   - optional lotNumber
   - optional includeRawPayload=true
3. Возвращает `NormalizedTenderDTO`:
   - externalPurchaseId
   - registryNumber
   - purchaseNumber
   - lotNumber
   - sourceUrl
   - platformName
   - title
   - subjectDescription
   - methodName
   - statusName
   - customer { name, inn, kpp, address }
   - price { maxPrice, priceFormula, currencyCode }
   - security { applicationSecurityAmount, contractSecurityAmount }
   - deadlines { applicationStartAt, applicationDeadlineAt, clarificationDeadlineAt, resultAt, publishedAt, updatedFromSourceAt }
   - delivery { deliveryPlace, deliveryPeriodText }
   - region { regionCode, regionName }
   - okpd2Codes
   - documents[]
   - requirements
   - criteria
   - changesFeed
   - sourcePayload
4. Нормализуй document types:
   NOTICE, DOCUMENTATION, CHANGE, CLARIFICATION, PROTOCOL, RESULT, CONTRACT_DRAFT, OTHER.
5. Добавь stable sourceHash/externalDocumentId там, где возможно.
6. На стороне apps/web добавь Zod schema или typed client validation для NormalizedTenderDTO, если такой слой уже существует или уместен.
7. Добавь mapping helper DTO -> Prisma-shaped input без фактической записи в БД.
8. Добавь tests:
   - normalize fixture success
   - missing optional fields become null/empty arrays
   - document type mapping
   - unknown purchase returns typed 404
   - Next-side Zod validation/mapping, если добавлен.

Жесткие ограничения:
- Не делай upsert в БД сегодня.
- Не делай watchlist cron.
- Не выводи sourceStage здесь как бизнес-истину, максимум верни statusName/source docs; sourceStage derivation будет Day 10/Next side.
- Не делай AI/alerts/scoring.

Acceptance criteria:
- Normalize endpoint возвращает DTO, близкий к Prisma Tender/Document.
- DTO выдерживает отсутствующие поля без падения.
- Document metadata пригодна для upsert в Day 09.
- Next-side validation готова принять DTO.
- FastAPI не пишет в PostgreSQL.

После реализации верни:
- DTO shape;
- пример normalized response;
- tests run;
- поля, которые пока остаются null из-за ограничений source.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 08.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только normalize endpoint, schemas, mapping helpers и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. NormalizedTenderDTO содержит нужные поля.
2. Optional/missing fields не ломают endpoint.
3. Document type mapping покрывает основные типы.
4. Unknown purchase возвращает typed 404/error.
5. Next-side validation/mapping не пишет в БД.
6. FastAPI не вычисляет внутренний kanban и не пишет бизнес-состояние.
7. Нет AI/alerts/scoring вне scope.

Ответ дай findings-first. Если блокеров нет, дай минимальный contract-test сценарий для Day 09.
```

## Daily result log

```md
# 2026-06-03

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать normalize endpoint и DTO contract.

## Done
-

## Checks
-

## Evidence
- Normalize request:
- Normalize response:
- DTO validation:

## Decisions
-

## Blockers
-

## Next day input
Day 09 должен подключить Next cron watchlists/run, upsert Tender/Document и dedupe.
```
