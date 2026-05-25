# Data model and Prisma plan

## Цель модели

Модель hybrid-first: фиксированные поля нужны для поиска, фильтрации, дедлайнов, канбана и scoring; JSONB-поля нужны для raw source payload, extracted requirements, checklist state и AI artifacts.

## Обязательные сущности

### User

Хранит профиль пользователя, timezone, настройки уведомлений, company profile и scoring policy.

Критично:

- `timezone` default `Europe/Moscow`;
- `companyProfile` как JSONB capability source для scoring;
- `alertPreferences` как JSONB, чтобы не плодить таблицы до MVP.

### SavedFilter

Хранит не только UI-форму, но и эксплуатационный watchlist:

- `includeKeywords`;
- `excludeKeywords`;
- `okpd2Prefixes`;
- `regionCodes`;
- `methodAllowList`;
- `customerInnAllowList`;
- `customerInnBlockList`;
- `minPrice`, `maxPrice`;
- `daysAhead`;
- `notifyOnNew`;
- `notifyOnChanges`;
- `lastRunAt`;
- `lastCursor`.

Unique: `[userId, name]`.

### KanbanStage

System stages:

- `INBOX`;
- `QUALIFY`;
- `GO`;
- `PREPARE`;
- `SUBMITTED_EXTERNALLY`;
- `WON`;
- `LOST`;
- `ARCHIVED`.

Seed их при создании пользователя или через onboarding job. Не смешивать с `sourceStage`.

### Tender

Главная агрегатная сущность.

Must-have:

- source identity: `externalPurchaseId`, `registryNumber`, `purchaseNumber`, `lotNumber`;
- source metadata: `sourceSystem`, `sourceUrl`, `payloadHash`;
- business fields: `title`, `customerName`, `customerInn`, `maxPrice`, `currencyCode`;
- deadlines: `applicationDeadlineAt`, `clarificationDeadlineAt`, `resultAt`;
- process fields: `sourceStage`, `decision`, `priority`, `kanbanStageId`;
- extracted JSON: `participationRequirements`, `requiredDocuments`, `evaluationCriteria`, `changesFeed`;
- AI/scoring: `scoreTotal`, `scoreConfidence`, `scoreBreakdown`, `decisionReason`.

Unique: `[userId, externalPurchaseId, lotNumber]`.

### Document

Документы закупки отделены от AI-результатов.

Must-have:

- `type`;
- `fileUrl`;
- `storageKey`;
- `sourceHash`;
- `extractionStatus`;
- `textContent`;
- `textChecksum`.

Важно: если нет text layer, статус должен быть `OCR_REQUIRED`; UI не должен показывать fake summary.

### AIAnalysis

Версионируемый результат AI:

- `kind`;
- `promptVersion`;
- `inputHash`;
- `summaryMd`;
- `requirements`;
- `risks`;
- `deadlines`;
- `fieldsExtracted`;
- `citations`;
- `rawResponse`.

Повторный запуск не должен затирать историю без причины. Для MVP можно хранить несколько записей и показывать latest completed.

## Миграционный порядок

1. Auth tables: `User`, `Account`, `Session`, `VerificationToken`.
2. Workspace tables: `SavedFilter`, `KanbanStage`.
3. Tender core: `Tender`, enums, базовые индексы.
4. Documents: `Document`.
5. AI: `AIAnalysis`.
6. Optional but recommended: `AlertDelivery`.

## Рекомендуемое расширение к отчету: AlertDelivery

В deep-research-report алерты описаны функционально, но для идемпотентности нужна таблица фактов отправки.

```prisma
enum AlertChannel {
  EMAIL
  TELEGRAM
}

enum AlertType {
  NEW_MATCH
  DEADLINE_T48
  DEADLINE_T24
  DEADLINE_T2
  NEW_CHANGE
  NEW_CLARIFICATION
  STAGE_SLA_BREACH
}

model AlertDelivery {
  id             String       @id @default(cuid())
  userId         String
  tenderId       String
  channel        AlertChannel
  type           AlertType
  idempotencyKey String       @unique
  payload        Json?        @db.JsonB
  sentAt         DateTime?    @db.Timestamptz(6)
  acknowledgedAt DateTime?   @db.Timestamptz(6)
  errorMessage   String?     @db.Text

  createdAt      DateTime     @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime     @updatedAt @db.Timestamptz(6)

  @@index([userId, tenderId])
  @@index([type, channel])
}
```

## Seed data

Минимальный seed:

- один тестовый пользователь;
- default kanban stages;
- 2 saved filters;
- 5 mock tenders;
- 2-3 documents на tender;
- 1 completed AIAnalysis для демонстрации карточки;
- 3 alert deliveries, включая duplicate skipped scenario.

## Правила для AI-агентов

- Не добавлять новые таблицы без объяснения, почему JSONB не хватает.
- Не удалять поля из схемы отчета.
- Не смешивать source status и kanban status.
- Все DateTime поля дедлайнов хранить как `Timestamptz`.
- Любой raw payload сохранять целиком в JSONB, но UI строить только через нормализованный DTO.

