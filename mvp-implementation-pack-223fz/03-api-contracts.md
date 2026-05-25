# API contracts

## Next.js Server Functions

Server Functions обслуживают UI mutations. Они всегда возвращают typed result-object:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> };
```

Обязательные функции:

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

Каждая функция обязана:

- вызвать `auth()`;
- валидировать input через Zod;
- проверить ownership по `userId`;
- выполнять идемпотентную запись;
- вернуть typed result;
- вызвать `revalidatePath()` для затронутых экранов.

## Next.js Route Handlers

```text
POST /api/cron/watchlists/run
POST /api/cron/analysis/run
POST /api/cron/alerts/run
POST /api/telegram/webhook
GET  /api/files/[documentId]
GET  /api/healthz
```

Cron routes:

- защищать `Authorization: Bearer ${CRON_SECRET}`;
- использовать advisory lock или эквивалент mutual exclusion;
- иметь timeout и batch size;
- логировать started/completed/failed;
- быть безопасными при повторном запуске.

## FastAPI endpoints

FastAPI возвращает DTO и не пишет в PostgreSQL.

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

## Минимальные DTO

### SavedFilterExecutionRequest

```json
{
  "filterId": "string",
  "userId": "string",
  "searchQuery": "string|null",
  "includeKeywords": ["string"],
  "excludeKeywords": ["string"],
  "okpd2Prefixes": ["string"],
  "regionCodes": ["string"],
  "methodAllowList": ["string"],
  "customerInnAllowList": ["string"],
  "customerInnBlockList": ["string"],
  "minPrice": "number|null",
  "maxPrice": "number|null",
  "daysAhead": 30,
  "cursor": "string|null"
}
```

### NormalizedTenderDTO

```json
{
  "externalPurchaseId": "string",
  "registryNumber": "string|null",
  "purchaseNumber": "string|null",
  "lotNumber": "string",
  "sourceUrl": "string|null",
  "platformName": "string|null",
  "title": "string",
  "subjectDescription": "string|null",
  "methodName": "string|null",
  "statusName": "string|null",
  "customer": {
    "name": "string|null",
    "inn": "string|null",
    "kpp": "string|null",
    "address": "string|null"
  },
  "price": {
    "maxPrice": "number|null",
    "priceFormula": "string|null",
    "currencyCode": "RUB"
  },
  "deadlines": {
    "applicationStartAt": "ISO-8601|null",
    "applicationDeadlineAt": "ISO-8601|null",
    "clarificationDeadlineAt": "ISO-8601|null",
    "resultAt": "ISO-8601|null",
    "publishedAt": "ISO-8601|null"
  },
  "documents": [
    {
      "externalDocumentId": "string|null",
      "type": "NOTICE|DOCUMENTATION|CHANGE|CLARIFICATION|PROTOCOL|RESULT|CONTRACT_DRAFT|OTHER",
      "title": "string",
      "fileName": "string|null",
      "fileUrl": "string|null",
      "publishedAt": "ISO-8601|null",
      "sourceHash": "string|null"
    }
  ],
  "requirements": {},
  "criteria": {},
  "sourcePayload": {}
}
```

### ExtractTextResponse

```json
{
  "status": "TEXT_READY|OCR_REQUIRED|FAILED",
  "text": "string|null",
  "textChecksum": "string|null",
  "pageCount": 0,
  "hasTextLayer": true,
  "metadata": {},
  "errorMessage": "string|null"
}
```

### TenderAnalysisResponse

```json
{
  "summaryMd": "string",
  "requirements": [],
  "risks": [],
  "deadlines": [],
  "requestedDocuments": [],
  "evaluationCriteria": [],
  "fieldsExtracted": {},
  "citations": [],
  "confidence": 0,
  "unknowns": [],
  "rawResponse": {}
}
```

## Contract tests

На каждый endpoint FastAPI:

- тест успешного ответа;
- тест валидации input;
- тест пустого результата;
- тест upstream failure;
- проверка, что DTO мапится в Zod schema клиента.

На каждый Next route:

- unauthorized returns 401/403;
- bad input returns typed error;
- duplicate run не создает дубли;
- ownership не пробивается чужим `id`.

