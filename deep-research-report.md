# Техническое задание MVP для Operational Workspace поставщика по 223-ФЗ

Этот MVP должен решать не задачу «полной тендерной платформы», а задачу управляемого операционного контура: найти релевантную закупку, быстро нормализовать карточку, принять решение `bid / no-bid`, провести ее через внутреннюю воронку, не пропустить изменения и дедлайны, а также сократить время чтения документации за счет extractive AI-summary. Такой контур хорошо ложится на текущую структуру данных ЕИС и публичных API-слоев, но требует жесткого разделения между источником данных, системным статусом закупки и внутренним рабочим статусом команды. citeturn7view0turn8view0turn8view1

## Критические данные ЕИС для MVP

Для первого релиза не нужен весь массив ЕИС. Для решения «участвовать / не участвовать» по 223-ФЗ критичны данные из извещения о конкурентной закупке и из прикрепленной документации. Закон требует, чтобы в извещении были указаны способ закупки, заказчик, предмет закупки, место поставки или выполнения работ, цена или формула цены, сроки подачи заявок; в документации — требования к участникам, состав заявки, условия поставки, порядок оплаты, критерии оценки и порядок сопоставления заявок. При этом в 223-ФЗ значимая часть практических правил часто закреплена в положении о закупке заказчика: общие требования, подписание договора, расчеты, обеспечение, основания отклонения, запросы на разъяснение. citeturn14search6turn23search3turn22search4

Архитектурно для MVP нужно брать только слой `закупки` плюс вложенные документы, а `планы закупок` и `договоры` оставить как future enrichment. Публичный API-слой по данным ЕИС отдает по 223-ФЗ именно эти три группы сущностей; при этом в v2 данные по 223-ФЗ загружаются только с 01.10.2024 и хранятся ориентировочно 3 года, поэтому сложную историческую аналитику и ML-score на старте делать рано. ЕИС-документы первично существуют как XML по XSD-схемам, а этап закупки напрямую в документах не хранится и должен выводиться из последнего типа документа. citeturn7view0turn8view0turn8view1

Практические 80% ценности дают следующие поля: номер закупки, предмет и лот, заказчик и ИНН, способ закупки, НМЦД или формула цены, дедлайн подачи, место и срок исполнения, условия оплаты, обеспечение заявки и договора, требования к участнику, критерии оценки, состав документов, изменения и разъяснения. Избыточны для MVP печатные формы, длинные служебные XML-блоки, полные профили организаций, планы закупок, реестр договоров и глубокая историческая связность. citeturn14search6turn23search3turn11search5turn8view1

## Схема данных

Модель должна быть hybrid-first: фиксированные поля под поиск, фильтрацию, дедлайны и scoring, плюс JSONB-тени под raw source payload, extracted requirements, чек-листы и AI-артефакты. Такой подход оправдан тем, что исходные 223-ФЗ документы приходят как XML/XSD, а Prisma поддерживает `Json`-поля и JSON-фильтрацию на PostgreSQL. Для аутентификации схема сразу включает стандартный минимум под Auth.js и route handler `/app/api/auth/[...nextauth]/route.ts`. citeturn8view0turn25search1turn30search0

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum LawType {
  FZ223
}

enum TenderDecision {
  UNDECIDED
  BID
  REVIEW
  NO_BID
}

enum SourceStage {
  UNKNOWN
  SUBMISSION_OPEN
  COMMISSION_WORK
  COMPLETED
  CANCELED
  EXPIRED
}

enum TenderPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum KanbanStageCode {
  INBOX
  QUALIFY
  GO
  PREPARE
  SUBMITTED_EXTERNALLY
  WON
  LOST
  ARCHIVED
}

enum DocumentType {
  NOTICE
  DOCUMENTATION
  CHANGE
  CLARIFICATION
  PROTOCOL
  RESULT
  CONTRACT_DRAFT
  OTHER
}

enum DocumentProcessingStatus {
  PENDING
  DOWNLOADING
  DOWNLOADED
  TEXT_READY
  OCR_REQUIRED
  FAILED
}

enum AnalysisKind {
  DOCUMENT_SUMMARY
  TENDER_SUMMARY
  REQUIREMENTS_EXTRACT
  CHANGE_DIFF
}

enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model User {
  id               String   @id @default(cuid())
  name             String?
  email            String?  @unique
  emailVerified    DateTime?
  image            String?

  telegramChatId   String?  @unique
  timezone         String   @default("Europe/Moscow")
  locale           String   @default("ru-RU")

  companyName      String?
  companyInn       String?
  companyProfile   Json?    @db.JsonB
  scoringPolicy    Json?    @db.JsonB
  alertPreferences Json?    @db.JsonB

  notifyEmail      Boolean  @default(true)
  notifyTelegram   Boolean  @default(false)

  accounts         Account[]
  sessions         Session[]
  savedFilters     SavedFilter[]
  kanbanStages     KanbanStage[]
  tenders          Tender[]

  createdAt        DateTime @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime @updatedAt @db.Timestamptz(6)
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String

  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@id([identifier, token])
}

model SavedFilter {
  id                    String    @id @default(cuid())
  userId                String
  name                  String
  isActive              Boolean   @default(true)

  searchQuery           String?   @db.Text
  includeKeywords       String[]  @default([])
  excludeKeywords       String[]  @default([])
  okpd2Prefixes         String[]  @default([])
  regionCodes           String[]  @default([])
  methodAllowList       String[]  @default([])
  customerInnAllowList  String[]  @default([])
  customerInnBlockList  String[]  @default([])

  minPrice              Decimal?  @db.Decimal(18, 2)
  maxPrice              Decimal?  @db.Decimal(18, 2)
  daysAhead             Int       @default(30)
  onlyWithSecurity      Boolean?
  onlyForMsp            Boolean?
  notifyOnNew           Boolean   @default(true)
  notifyOnChanges       Boolean   @default(true)

  scoringWeights        Json?     @db.JsonB
  lastRunAt             DateTime? @db.Timestamptz(6)
  lastCursor            String?
  lastResultCount       Int       @default(0)

  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenders               Tender[]

  createdAt             DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime  @updatedAt @db.Timestamptz(6)

  @@unique([userId, name])
  @@index([userId, isActive])
}

model KanbanStage {
  id                String           @id @default(cuid())
  userId            String
  code              KanbanStageCode
  name              String
  position          Int
  isSystem          Boolean          @default(true)
  isTerminal        Boolean          @default(false)
  slaHours          Int?
  colorToken        String?
  checklistTemplate Json?            @db.JsonB

  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenders           Tender[]

  createdAt         DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime         @updatedAt @db.Timestamptz(6)

  @@unique([userId, code])
  @@unique([userId, position])
  @@index([userId])
}

model Tender {
  id                       String         @id @default(cuid())
  userId                   String
  savedFilterId            String?
  kanbanStageId            String

  lawType                  LawType        @default(FZ223)
  externalPurchaseId       String
  registryNumber           String?
  purchaseNumber           String?
  lotNumber                String         @default("0")
  sourceSystem             String         @default("EIS_223")
  sourceUrl                String?        @db.Text
  platformName             String?
  platformUrl              String?        @db.Text
  payloadHash              String?

  title                    String
  subjectDescription       String?        @db.Text
  methodName               String?
  statusName               String?
  sourceStage              SourceStage    @default(UNKNOWN)
  decision                 TenderDecision @default(UNDECIDED)
  priority                 TenderPriority @default(MEDIUM)

  customerName             String?
  customerInn              String?
  customerKpp              String?
  customerAddress          String?
  contactName              String?
  contactEmail             String?
  contactPhone             String?

  maxPrice                 Decimal?       @db.Decimal(18, 2)
  priceFormula             String?        @db.Text
  currencyCode             String         @default("RUB")
  applicationSecurityAmount Decimal?      @db.Decimal(18, 2)
  contractSecurityAmount   Decimal?       @db.Decimal(18, 2)
  paymentTermsText         String?        @db.Text
  deliveryPlace            String?        @db.Text
  deliveryPeriodText       String?        @db.Text

  applicationStartAt       DateTime?      @db.Timestamptz(6)
  applicationDeadlineAt    DateTime?      @db.Timestamptz(6)
  clarificationDeadlineAt  DateTime?      @db.Timestamptz(6)
  reviewAt                 DateTime?      @db.Timestamptz(6)
  resultAt                 DateTime?      @db.Timestamptz(6)
  publishedAt              DateTime?      @db.Timestamptz(6)
  updatedFromSourceAt      DateTime?      @db.Timestamptz(6)
  lastSeenAt               DateTime       @default(now()) @db.Timestamptz(6)

  regionCode               String?
  regionName               String?
  okpd2Codes               String[]       @default([])
  okved2Codes              String[]       @default([])
  keywords                 String[]       @default([])

  participationRequirements Json?         @db.JsonB
  requiredDocuments        Json?          @db.JsonB
  evaluationCriteria       Json?          @db.JsonB
  changesFeed              Json?          @db.JsonB

  checklistState           Json?          @db.JsonB
  scoreBreakdown           Json?          @db.JsonB
  sourcePayload            Json?          @db.JsonB
  normalizedPayload        Json?          @db.JsonB

  scoreTotal               Int?
  scoreFit                 Int?
  scoreEconomics           Int?
  scoreExecutionRisk       Int?
  scoreComplianceRisk      Int?
  scoreUrgency             Int?
  scoreConfidence          Int?
  decisionReason           String?        @db.Text
  ownerComment             String?        @db.Text

  lastScoredAt             DateTime?      @db.Timestamptz(6)
  lastAlertedAt            DateTime?      @db.Timestamptz(6)

  user                     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  savedFilter              SavedFilter?   @relation(fields: [savedFilterId], references: [id], onDelete: SetNull)
  kanbanStage              KanbanStage    @relation(fields: [kanbanStageId], references: [id], onDelete: Restrict)
  documents                Document[]
  aiAnalyses               AIAnalysis[]

  createdAt                DateTime       @default(now()) @db.Timestamptz(6)
  updatedAt                DateTime       @updatedAt @db.Timestamptz(6)

  @@unique([userId, externalPurchaseId, lotNumber])
  @@index([userId, applicationDeadlineAt])
  @@index([userId, kanbanStageId])
  @@index([userId, decision])
  @@index([userId, updatedFromSourceAt])
  @@index([customerInn])
  @@index([scoreTotal])
}

model Document {
  id               String                   @id @default(cuid())
  tenderId         String
  externalDocumentId String?
  type             DocumentType             @default(OTHER)

  title            String
  fileName         String?
  fileUrl          String?                  @db.Text
  storageKey       String?
  versionLabel     String?
  mimeType         String?
  sizeBytes        Int?
  sourceHash       String?

  publishedAt      DateTime?                @db.Timestamptz(6)
  downloadedAt     DateTime?                @db.Timestamptz(6)
  extractionStatus DocumentProcessingStatus @default(PENDING)
  hasTextLayer     Boolean?
  pageCount        Int?
  textContent      String?                  @db.Text
  textChecksum     String?
  metadata         Json?                    @db.JsonB

  tender           Tender                   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  analyses         AIAnalysis[]

  createdAt        DateTime                 @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime                 @updatedAt @db.Timestamptz(6)

  @@index([tenderId, type])
  @@index([tenderId, extractionStatus])
  @@index([externalDocumentId])
}

model AIAnalysis {
  id             String         @id @default(cuid())
  tenderId       String
  documentId     String?
  kind           AnalysisKind
  status         AnalysisStatus @default(PENDING)

  provider       String?
  modelName      String?
  promptVersion  String         @default("v1")
  language       String         @default("ru")
  inputHash      String?

  summaryMd      String?        @db.Text
  requirements   Json?          @db.JsonB
  risks          Json?          @db.JsonB
  deadlines      Json?          @db.JsonB
  fieldsExtracted Json?         @db.JsonB
  citations      Json?          @db.JsonB
  rawResponse    Json?          @db.JsonB

  tokensIn       Int?
  tokensOut      Int?
  costRub        Decimal?       @db.Decimal(12, 4)
  errorMessage   String?        @db.Text
  completedAt    DateTime?      @db.Timestamptz(6)

  tender         Tender         @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  document       Document?      @relation(fields: [documentId], references: [id], onDelete: SetNull)

  createdAt      DateTime       @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime       @updatedAt @db.Timestamptz(6)

  @@index([tenderId, kind, status])
  @@index([documentId])
}
```

Практические решения, которые зашиты в эту схему: `Tender.sourceStage` и `Tender.kanbanStageId` разделены; `SavedFilter` хранит эксплуатационные параметры watchlist, а не только UI-форму; `Document` хранит текст отдельно от AI-результатов; `AIAnalysis` versioned через `kind + inputHash + promptVersion`; `User.companyProfile` — это минимальный источник capability-данных для scoring. Этого достаточно, чтобы начать код без дополнительной ERP-модели.

## Сервисная архитектура и API-контракты

Next.js должен быть system of record для бизнес-состояния, а FastAPI — stateless compute/adaptation service. Это соответствует стеку: App Router использует Server Components, Suspense и Server Functions; Route Handlers в `app` — штатный HTTP-примитив и эквивалент API routes в старом router; Server Functions исполняются на сервере, но доступны через прямые `POST`-вызовы, поэтому их нельзя считать «внутренними» только потому, что они вызываются из UI. citeturn27search0turn24search0turn27search2turn27search4

FastAPI нужен именно там, где есть внешняя интеграция, документный parsing и AI. Он по умолчанию отдает OpenAPI schema на `/openapi.json` и interactive docs на `/docs`, что полезно и для frontend-клиента, и для AI-агентов разработки. Но Postgres должен писать только Next.js через Prisma; это убирает дрейф схемы между Prisma и вторым ORM, а FastAPI возвращает только DTO. citeturn26search1turn26search2turn26search10

Рекомендуемая структура проекта:

```text
apps/web
  app/(app)/watchlists/page.tsx
  app/(app)/tenders/page.tsx
  app/(app)/tenders/[id]/page.tsx
  app/(app)/board/page.tsx

  app/api/auth/[...nextauth]/route.ts
  app/api/cron/watchlists/run/route.ts
  app/api/cron/analysis/run/route.ts
  app/api/cron/alerts/run/route.ts
  app/api/telegram/webhook/route.ts
  app/api/files/[documentId]/route.ts
  app/api/healthz/route.ts

  src/actions/watchlists.ts
  src/actions/tenders.ts
  src/actions/kanban.ts
  src/actions/checklists.ts
  src/actions/analysis.ts

  src/lib/prisma.ts
  src/lib/auth.ts
  src/lib/validators/*.ts
  src/lib/clients/fastapi.client.ts
  src/lib/adapters/eis223.adapter.ts
  src/lib/scoring/bidNoBid.ts
  src/lib/alerts/*.ts

apps/api
  app/main.py
  app/routers/eis223.py
  app/routers/documents.py
  app/routers/ai.py
  app/services/provider_gosplan.py
  app/services/pdf_extract.py
  app/services/ocr_fallback.py
  app/services/prompting.py
  app/schemas/*.py
```

### Контракты Next.js

**Server Functions** должны обслуживать только UI-mutations и всегда возвращать typed result-object, а не бросать свободный текст. Обязательные функции:

```ts
createSavedFilter(input)
updateSavedFilter(input)
deleteSavedFilter(filterId)
previewSavedFilter(filterId)
moveTenderToStage(tenderId, stageCode)
updateTenderChecklist(tenderId, checklistState)
setTenderDecision(tenderId, decision, reason)
rescoreTender(tenderId)
requestTenderAnalysis(tenderId)
acknowledgeAlert(tenderId, channel, type)
```

Каждая функция обязана делать: `auth()`, Zod-валидацию, проверку ownership по `userId`, идемпотентную запись и `revalidatePath()` соответствующего экрана.

**Route Handlers** нужны для cron, webhooks и machine-to-machine вызовов:

- `POST /api/cron/watchlists/run` — запускает активные фильтры, подтягивает новые/измененные закупки, upsert-ит `Tender`, создает/обновляет `Document`.
- `POST /api/cron/analysis/run` — выбирает `Document`/`AIAnalysis` со статусом `PENDING`, вызывает FastAPI, сохраняет текст и extracted data.
- `POST /api/cron/alerts/run` — проверяет дедлайны, изменения, просроченные SLA по канбану, отправляет Telegram/Email.
- `POST /api/telegram/webhook` — принимает callback от Telegram-бота, если нужен bot-driven UX.
- `GET /api/files/[documentId]` — secure proxy на скачивание документа из storage.
- `GET /api/healthz` — liveness/readiness.

Все cron routes надо защищать `Authorization: Bearer ${CRON_SECRET}` и блокировать повторный запуск advisory-lock’ом на PostgreSQL либо эквивалентной mutual exclusion логикой.

### Контракты FastAPI

FastAPI не хранит бизнес-состояние. Он принимает input, возвращает typed DTO:

```text
POST /v1/eis223/search
POST /v1/eis223/purchase/{externalPurchaseId}/normalize
POST /v1/documents/extract-text
POST /v1/ai/summarize-document
POST /v1/ai/summarize-tender
POST /v1/ai/diff-document
GET  /healthz
GET  /openapi.json
GET  /docs
```

Минимальные Pydantic-контракты:

- `SavedFilterExecutionRequest`
- `NormalizedTenderDTO`
- `ExtractTextRequest`
- `ExtractTextResponse`
- `TenderAnalysisRequest`
- `TenderAnalysisResponse`
- `DocumentDiffResponse`

`NormalizedTenderDTO` должен уже приходить в форме, близкой к `Tender` из Prisma: `externalPurchaseId`, `registryNumber`, `title`, `customer`, `price`, `deadlines`, `requirements`, `criteria`, `documents`, `sourcePayload`.

### Алгоритм вывода системного этапа закупки

Так как этап закупки в документах как отдельное поле не хранится, его надо вычислять самостоятельно. Канонический MVP-алгоритм:

- есть только извещение / notice → `SUBMISSION_OPEN`;
- появился любой протокол → `COMMISSION_WORK`;
- появился итоговый результат / отмена → `COMPLETED` или `CANCELED`;
- дедлайн подачи прошел, а новых документов нет → `EXPIRED`, если итог не найден;
- внутренний канбан при этом не меняется автоматически, кроме опционального rule-based suggestion. citeturn8view1

### SLA и ограничения внешнего источника

Новые извещения, контракты и планы закупок в публичном API-слое загружаются в течение примерно двух часов после публикации в ЕИС, а остальные документы — протоколы, разъяснения и прочее — с 03:00 до 09:00 МСК следующего дня. Это означает, что alert engine нельзя проектировать как real-time stream. Дополнительно надо учесть upstream-риск: продуктовый сервер после 01.08.2026 требует API-ключ, базовый тариф заявлен в 3 000 ₽/месяц, а тестовый сервер имеет лимит 10 запросов в минуту. Поэтому обязателен provider adapter abstraction и локальный change-detection cache. citeturn7view0

## AI-summary и пайплайн парсинга документации

AI-модуль должен быть строго extractive, а не «магическим». По 223-ФЗ в ЕИС публикуются не только извещение и документация, но и изменения, разъяснения, протоколы и итоговый протокол; именно там возникают operational risks для поставщика. При этом часть ключевых правил по 223-ФЗ часто закреплена в положении о закупке заказчика, включая общие требования, расчеты, обеспечение, основания отклонения и запросы на разъяснение. Поэтому AI-результат должен всегда показывать не только summary, но и `unknowns` и `confidence`, если документ неполный или положение о закупке не анализировалось. citeturn11search1turn11search5turn22search4turn23search3

Пайплайн должен работать так: Next.js создает `Document` со статусом `PENDING`; cron запускает FastAPI `extract-text`; FastAPI сначала пытается извлечь text layer, затем при необходимости включает OCR fallback только для scanned pages; затем chunking, LLM extraction и structured JSON result; Next.js валидирует ответ и сохраняет его в `AIAnalysis`. Хранить надо и summary, и machine-readable fields, и source spans. С учетом XML/XSD-природы исходных документов важно сохранять `sourcePayload` и `textChecksum`, иначе вы не сможете надежно отследить изменения, переанализировать документ и обосновать результат пользователю. citeturn8view0turn25search1

Рекомендуемый system prompt:

```text
Ты — аналитик закупочной документации по 223-ФЗ.
Твоя задача — делать только extractive analysis.
Нельзя додумывать требования, сроки, допуски, сертификаты, основания отклонения или условия договора.
Если информации нет прямо в тексте, верни null или добавь пункт в unknowns.

Контекст:
- Ниже передан текст извещения, документации, изменений, разъяснений и/или протоколов.
- Нужно помочь поставщику быстро принять решение "участвовать / не участвовать".
- Вывод только в JSON по заданной схеме.
- Все извлеченные факты должны иметь source_spans: document_title, page_or_section, short_quote.

Верни JSON:
{
  "executive_summary": "string",
  "participation_recommendation_hint": {
    "status": "bid|review|no_bid",
    "confidence": 0
  },
  "deadlines": [
    {
      "type": "application_deadline|clarification_deadline|result_date|contract_signing",
      "value": "ISO-8601 or null",
      "source_spans": [...]
    }
  ],
  "financial_terms": {
    "max_price": "number|null",
    "currency": "string|null",
    "application_security": "number|null",
    "contract_security": "number|null",
    "payment_terms": "string|null",
    "source_spans": [...]
  },
  "requirements": [
    {
      "category": "license|certificate|experience|staff|equipment|product_spec|delivery|financial|other",
      "title": "string",
      "mandatory": true,
      "value": "string|null",
      "source_spans": [...]
    }
  ],
  "requested_documents": [
    {
      "title": "string",
      "mandatory": true,
      "source_spans": [...]
    }
  ],
  "evaluation_criteria": [
    {
      "name": "string",
      "weight": "number|null",
      "source_spans": [...]
    }
  ],
  "risks": [
    {
      "severity": "low|medium|high",
      "risk": "string",
      "why_it_matters": "string",
      "source_spans": [...]
    }
  ],
  "unknowns": [
    {
      "question": "string",
      "why_blocking": "string"
    }
  ]
}
```

Ожидаемая бизнес-логика поверх AI:

- если найдены hard blockers, scoring engine ставит `NO_BID`, даже если общая сумма баллов высокая;
- если нет hard blockers, но `confidence < 60`, итог должен быть `REVIEW`, а не `BID`;
- если положение о закупке заказчика не анализировалось, score confidence по умолчанию режется на 10–20 пунктов, потому что для 223-ФЗ значимая часть процедурных рисков живет именно там. citeturn22search4

## Функциональное ТЗ модулей MVP

Ниже — операционное ТЗ шести модулей. Они построены вокруг реально значимых полей извещения и документации и вокруг того ограничения, что системный stage надо выводить из документов, а не читать готовым полем. citeturn14search6turn23search3turn8view1

**Watchlist с правилами поиска.**  
Ключевые фичи: CRUD сохраненных фильтров; preview matching results; активный/неактивный watchlist; дедупликация новых совпадений; сохранение `lastRunAt` и `lastCursor`; one-click “создать тендер в работе” из результата предпросмотра. Входящие данные: `searchQuery`, include/exclude keywords, OKPD2 prefixes, customer allow/block INN, регионы, методы, price range, horizon `daysAhead`, флаги `onlyWithSecurity` и `onlyForMsp`. Исходящие данные: список `NormalizedTenderHit`, число новых совпадений, upsert в `Tender`. UX: таблица или list view с быстрой сортировкой по цене, дедлайну, score и клиенту; справа — panel “почему совпало”. Watchlist должен запускаться по кнопке вручную и по расписанию через cron.

**Нормализованная карточка закупки.**  
Ключевые фичи: агрегировать сырой source payload в один экран принятия решения; separate sections `Header`, `Economics`, `Timeline`, `Requirements`, `Documents`, `Changes`, `AI`; версионность по `payloadHash`; human-readable badge текущего source stage. Входящие данные: `Tender`, `Document[]`, latest `AIAnalysis`, derived `sourceStage`. Исходящие данные: page DTO для рендера карточки. UX: header с номером закупки, customer, price, deadline countdown, decision badge и score; средняя колонка — требования и состав заявки; правая колонка — риски, неизвестности, последние изменения и quick actions: `Rescore`, `Run AI`, `Move stage`.

**Bid / No-bid scoring.**  
Ключевые фичи: rule-based scoring v1 без ML; hard blockers; explainable score breakdown; separated `scoreTotal` и `scoreConfidence`; ручной override решения. Входящие данные: нормализованная карточка, `User.companyProfile`, `User.scoringPolicy`, AI-extracted requirements/risks. Исходящие данные: `decision`, `scoreTotal`, `scoreBreakdown`, `decisionReason`. Рекомендуемая формула: `fit 0-30 + economics 0-20 + execution 0-20 + compliance 0-20 + urgency 0-10`. Hard blockers: лицензия/сертификат недоступны, неподдерживаемый регион, обеспечение выше лимита компании, дедлайн подготовки ниже минимального окна, явно неприемлемые условия оплаты, обязательный опыт/референсы недостижимы. Thresholds: `>= 70 => BID`, `50..69 => REVIEW`, `< 50 => NO_BID`. UX: справа от карточки — radar-like breakdown не нужен; достаточно пяти полос с оценками и блока “почему нет / почему да”. Этот модуль должен быть explainable, потому что для 223-ФЗ требования, критерии и порядок оценки должны быть явно указаны в документации, а procedural risks часто живут в положении о закупке. citeturn23search0turn23search3turn22search4

**Канбан-воронка и чек-листы.**  
Ключевые фичи: системные стадии `INBOX → QUALIFY → GO → PREPARE → SUBMITTED_EXTERNALLY → WON/LOST → ARCHIVED`; ручное drag-and-drop; stage-specific checklist template; SLA timer на стадии; комментарии владельца. Входящие данные: `Tender`, `KanbanStage`, `checklistState`. Исходящие данные: обновленный `kanbanStageId`, `checklistState`, `ownerComment`. UX: board view с карточками по колонкам и counters по дедлайнам; на карточке — номер, цена, дедлайн, score, top risk, процент готовности checklist. Важно: `sourceStage` и `kanbanStage` должны отображаться отдельно. Например, source stage может уже быть `COMPLETED`, а рабочая карточка еще в `LOST` не закрыта внутренне.

**Алерты Telegram / Email.**  
Ключевые фичи: события `new_match`, `deadline_t48`, `deadline_t24`, `deadline_t2`, `new_change`, `new_clarification`, `stage_sla_breach`; instant и digest режимы; idempotency key, чтобы не дублировать оповещения. Входящие данные: `Tender`, `SavedFilter`, `Document changes`, user alert prefs. Исходящие данные: запись факта отправки и уведомление в канал. UX: в профиле пользователя — матрица правил отправки; в карточке закупки — история отправленных алертов. Тексты алертов должны быть короткими: номер закупки, заказчик, критическое событие, дедлайн, deep link в карточку. Для change alerts необходимо помнить, что изменения и разъяснения по 223-ФЗ являются отдельными обязательными публикациями, а upstream API подтягивает часть вторичных документов с ночной задержкой; следовательно, в UI надо явно показывать `source freshness`. citeturn11search5turn7view0

**AI-summary документации.**  
Ключевые фичи: extractive summary по одному документу и по тендеру целиком; explicit `unknowns`; сохранение `source_spans`; diff-analysis при новом `payloadHash`; кнопка “обновить summary” вручную. Входящие данные: текст извещения, документации, изменений, разъяснений, протоколов; optional text положения о закупке. Исходящие данные: `AIAnalysis` с `summaryMd`, `requirements`, `risks`, `deadlines`, `requested_documents`, `evaluation_criteria`. UX: справа в карточке — компактный summary, ниже блоки “обязательные документы”, “критические риски”, “что еще проверить”. Если документ не содержит text layer, интерфейс обязан показывать статус `OCR_REQUIRED` и не симулировать результат. Confidence summary надо снижать, если положение о закупке не было проанализировано, потому что именно там в 223-ФЗ часто живут основания отклонения, обеспечение, порядок подписания и расчетов. citeturn22search4turn8view0

## Спринты, риски и критерии готовности

### Спринт первый

Цель: поднять skeleton продукта и получить read-only операционный контур.

Объем: Auth.js; seed default `KanbanStage`; CRUD `SavedFilter`; экран watchlists; экран списка тендеров; моковый provider adapter; read-only карточка тендера из тестовых данных; Prisma migrations; health endpoints.

Инкремент: пользователь может войти, создать фильтр, увидеть список найденных тендеров и открыть карточку.

Критерий готовности: один пользователь полностью проходит onboarding; создается хотя бы один `SavedFilter`; список тендеров и карточка работают без AI и без cron.

### Спринт второй

Цель: подключить реальный внешний source и получить нормализованную карточку.

Объем: FastAPI `/v1/eis223/search` и `/normalize`; Next cron `watchlists/run`; upsert `Tender`; загрузка document metadata; derivation `sourceStage`; dedupe по `[userId, externalPurchaseId, lotNumber]`; payload hashing; ручной запуск “обновить закупку”.

Инкремент: система реально подтягивает matching 223-ФЗ закупки из внешнего API и строит нормализованную карточку.

Критерий готовности: появление реальных тендеров в board/list, корректный дедлайн, цена, заказчик, документы и source stage минимум на контрольной выборке из 20 закупок.

### Спринт третий

Цель: замкнуть operational loop.

Объем: канбан-воронка; checklist state; scoring engine v1; ручной override решения; alert engine для `deadline_t48/t24/t2` и `new_match`; email и Telegram adapters; журнал отправок; owner comments.

Инкремент: пользователь может взять закупку в работу, провести ее по стадиям, получить решение bid/no-bid и алерты.

Критерий готовности: на тестовом наборе не менее 90% алертов отправляются без дублей; score сохраняется и объясняется; перемещение карточки между стадиями устойчиво.

### Спринт четвертый

Цель: сократить ручное чтение документов и закрыть MVP.

Объем: `extract-text`; OCR fallback; `AIAnalysis`; `/v1/ai/summarize-document`; `/v1/ai/summarize-tender`; change diff; UI risk panel; final QA; error handling; empty states; access control на file proxy.

Инкремент: у каждой закупки с документами можно получить AI-summary и список рисков с source spans.

Критерий готовности: для контрольной выборки из 10–15 закупок AI-модуль стабильно извлекает deadlines, список обязательных документов и хотя бы 3–5 meaningful risks без галлюцинаций; пользователь может принять решение без чтения всего PDF вручную.

### Технологические риски и решения

Главный риск стека — не FastAPI и не Next сами по себе, а граница между ними. Если оба сервиса начнут писать в ту же БД, вы быстро получите schema drift и сложные race conditions. Поэтому Next.js должен быть единственным writer в PostgreSQL; FastAPI — только compute service с typed DTO и OpenAPI contract. Для внутренних HTTP-маршрутов используйте Route Handlers, для UI-модификаций — Server Functions, но помните, что Server Functions вызываются через `POST` и должны считаться полноценной mutation surface с обязательными authz и validation. citeturn24search0turn27search2turn27search4turn26search2

Риск источника данных: текущий публичный API-слой по данным ЕИС удобен для MVP, но имеет ограничения по historical depth, schedule freshness, rate limits и monetization после 01.08.2026. Поэтому abstraction `EIS223Adapter` обязательна с первого дня, а scoring v1 должен быть rule-based, без попытки строить “умную” историю побед/поражений на коротком временном ряду. citeturn7view0

Риск модели предметной области: в 223-ФЗ значимая часть процедурных рисков живет в положении о закупке заказчика, а не только в извещении. Поэтому `scoreConfidence` должен присутствовать как отдельная метрика, а отсутствие анализа положения о закупке должно понижать confidence автоматически. Отдельно, поскольку source stage не приходит готовым полем из документов, в системе должна быть сохранена ручная override-возможность и audit-friendly пояснение, каким правилом stage был вычислен. citeturn22search4turn8view1

Риск compliance: если продукт собирает персональные данные российских пользователей, нужно закладывать локализацию primary DB в РФ, потому что при сборе персональных данных граждан РФ запись, систематизация, накопление, хранение, уточнение и извлечение с использованием баз данных за пределами РФ не допускаются, кроме специальных исключений закона. Для MVP это означает: основной Postgres — в российском контуре, а в Telegram/email не отправлять вложения и чувствительные данные, только метаданные и ссылку на карточку. citeturn29search0

Итоговый definition of done для MVP: пользователь создает watchlist, система подтягивает релевантные закупки 223-ФЗ, строит нормализованную карточку, расставляет explainable bid/no-bid score, проводит закупку через канбан и чек-лист, присылает дедлайн- и change-alerts, а также выдает extractive AI-summary документации с source spans. На этой точке продукт уже можно показывать пилотным поставщикам и брать оплату за контроль дедлайнов и сокращение ручного хаоса.