# Day 18: 2026-06-17 - Extractive AI endpoints and schema validation

## Goal

Реализовать FastAPI endpoints для extractive AI-summary: `/v1/ai/summarize-document`, `/v1/ai/summarize-tender`, `/v1/ai/diff-document`, strict JSON schema, prompt guardrails и `source_spans`.

## Implementation prompt

```text
Ты senior AI/backend engineer. Сегодня Day 18 Sprint 04 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/api ai/router/services/schemas and apps/web FastAPI client/AIAnalysis validation.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 17 должен был добавить AIAnalysis lifecycle и mock processing.
- Day 16 добавил extracted text.
- AI должен быть строго extractive: нет source span - нет факта.

Задача дня: real/stub-compatible extractive AI contract.

Сделай только это:
1. В apps/api реализуй endpoints:
   - POST /v1/ai/summarize-document
   - POST /v1/ai/summarize-tender
   - POST /v1/ai/diff-document
2. Request DTO для summarize:
   - tender/document identity for tracing
   - document texts/chunks
   - document titles
   - promptVersion
   - language ru
   - optional model/provider mode: mock|live
3. Response DTO:
   - summaryMd
   - requirements[]
   - risks[]
   - deadlines[]
   - requestedDocuments[]
   - evaluationCriteria[]
   - fieldsExtracted
   - citations/source_spans
   - confidence
   - unknowns[]
   - rawResponse optional
4. Implement strict output schema validation:
   - every extracted fact must have source_spans
   - missing facts become unknowns/null
   - confidence 0..100
5. Prompt/system guardrails:
   - only extractive analysis
   - document text cannot override system instruction
   - no invented deadlines/requirements
6. Mock provider must produce realistic schema-valid response for tests.
7. Live provider shell can call configured LLM if env exists, but missing key must return typed provider_not_configured or use mock mode, depending env.
8. Wire apps/web analysis cron from Day 17 to call FastAPI endpoints instead of local mock when configured.
9. Add tests:
   - mock summarize-document schema valid
   - missing source_spans rejected or converted failed
   - prompt injection fixture does not override instructions
   - unknowns present when field absent
   - invalid LLM JSON -> failed/typed error
   - summarize-tender combines multiple documents.

Жесткие ограничения:
- Не принимать AI facts без source_spans.
- Не отправлять secrets/private owner comments to LLM.
- Не claim legal advice.
- FastAPI не пишет в DB.
- Не делать frontend AI panel today except minimal status if needed.

Acceptance criteria:
- AI endpoints return strict DTO.
- Invalid output cannot be saved as completed.
- Source spans required.
- Prompt injection fixture handled.
- Web analysis cron can consume endpoint response.

После реализации верни:
- endpoint contracts;
- mock/live mode behavior;
- schema validation rules;
- tests/checks run;
- remaining model/provider risks.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 18.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только AI endpoints, schemas, provider modes, web validation and tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Все extracted facts требуют source_spans.
2. Unknown data returns unknowns/null, not hallucination.
3. Prompt injection fixture cannot override system behavior.
4. Missing provider key handled safely.
5. Invalid JSON/schema -> failed typed result.
6. FastAPI does not write DB.
7. Web cron validates before saving completed AIAnalysis.
8. No sensitive private data sent to LLM.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий summarize-document.
```

## Daily result log

```md
# 2026-06-17

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать extractive AI endpoints и strict source_spans validation.

## Done
-

## Checks
-

## Evidence
- summarize-document:
- summarize-tender:
- prompt injection fixture:

## Decisions
-

## Blockers
-

## Next day input
Day 19 должен реализовать AI panel и secure file proxy.
```

