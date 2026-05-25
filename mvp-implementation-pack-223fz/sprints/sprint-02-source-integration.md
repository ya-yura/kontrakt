# Sprint 02: Real source integration and normalized tender card

## Цель недели

Подключить реальный внешний source через FastAPI и получить нормализованную карточку закупки из live data.

## Инкремент

Система подтягивает matching 223-ФЗ закупки из внешнего API, upsert-ит их в Postgres и строит нормализованную карточку с документами и source stage.

## Scope

- FastAPI `/v1/eis223/search`.
- FastAPI `/v1/eis223/purchase/{externalPurchaseId}/normalize`.
- Provider adapter abstraction.
- Next.js `POST /api/cron/watchlists/run`.
- Manual "run watchlist" action.
- `Tender` upsert.
- `Document` metadata upsert.
- `payloadHash`.
- `sourceStage` derivation.
- Dedupe by `[userId, externalPurchaseId, lotNumber]`.
- Source freshness indicators.

## Out of scope

- AI-summary;
- OCR;
- scoring engine;
- Telegram/email;
- автоматическая подача заявок.

## Tasks

### 1. Provider adapter

- Создать интерфейс `EIS223Provider`.
- Реализовать adapter для выбранного внешнего источника.
- Обернуть rate limits и upstream errors в typed errors.
- Добавить local fixture mode для разработки.

Acceptance:

- FastAPI может работать в live mode и fixture mode;
- upstream error не падает raw traceback в клиент.

### 2. Search endpoint

- Реализовать `POST /v1/eis223/search`.
- Принимать `SavedFilterExecutionRequest`.
- Возвращать normalized hits.
- Поддержать cursor/lastRunAt, если источник позволяет.

Acceptance:

- фильтр по ключевым словам, региону, цене и дедлайну работает на контрольной выборке;
- пустой результат возвращается как `[]`, не как ошибка.

### 3. Normalize endpoint

- Реализовать `/normalize`.
- Привести данные к `NormalizedTenderDTO`.
- Сохранить raw `sourcePayload`.
- Нормализовать документы и document types.

Acceptance:

- DTO мапится в Prisma `Tender` и `Document`;
- отсутствующие поля становятся `null`, а не ломают пайплайн.

### 4. Watchlist cron route

- `POST /api/cron/watchlists/run`.
- Auth через `CRON_SECRET`.
- Advisory lock.
- Batch active filters.
- Upsert tender/document.
- Update `lastRunAt`, `lastCursor`, `lastResultCount`.

Acceptance:

- повторный запуск не создает дубли;
- payload hash меняется при изменении source payload;
- document metadata обновляется.

### 5. Source stage derivation

Правила MVP:

- только notice -> `SUBMISSION_OPEN`;
- любой protocol -> `COMMISSION_WORK`;
- result/cancel -> `COMPLETED` или `CANCELED`;
- дедлайн прошел, итог не найден -> `EXPIRED`;
- иначе `UNKNOWN`.

Acceptance:

- stage объясним в UI;
- внутренний kanban не меняется автоматически.

## Tests

- FastAPI unit tests with fixtures.
- Contract tests DTO -> Zod -> Prisma mapping.
- Cron route unauthorized test.
- Cron route duplicate run test.
- Source stage table tests.
- Control sample of 20 tenders.

## Definition of done

- Реальные тендеры появляются в board/list.
- На 20 закупках корректны дедлайн, цена, заказчик, документы и source stage.
- UI показывает source freshness и не обещает real-time stream.

