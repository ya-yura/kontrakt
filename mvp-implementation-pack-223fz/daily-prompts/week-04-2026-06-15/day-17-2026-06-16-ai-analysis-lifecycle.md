# Day 17: 2026-06-16 - AIAnalysis lifecycle and queue

## Goal

Реализовать жизненный цикл `AIAnalysis`: pending/running/completed/failed, versioning через `kind + inputHash + promptVersion`, idempotent creation и safe retries. Сегодня можно использовать mock AI response, но без production LLM-зависимости.

## Implementation prompt

```text
Ты senior Next.js/backend engineer. Сегодня Day 17 Sprint 04 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web AIAnalysis/analysis actions/cron/Prisma/tender card и apps/api ai schemas, если есть.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 16 должен был добавить document extraction и сохранить textContent/textChecksum.
- AIAnalysis model уже есть в Prisma.
- Next.js пишет business state, FastAPI возвращает DTO.

Задача дня: AIAnalysis lifecycle.

Сделай только это:
1. Реализуй helper для `inputHash`:
   - based on document textChecksum / tender payloadHash / included document checksums;
   - stable and deterministic.
2. Реализуй `requestTenderAnalysis(tenderId)`:
   - auth()
   - ownership check
   - validates documents/text readiness
   - creates or reuses pending AIAnalysis for `TENDER_SUMMARY`
   - typed ActionResult
   - revalidatePath tender card
3. Реализуй `requestDocumentAnalysis(documentId)` или internal helper для `DOCUMENT_SUMMARY`, если удобно.
4. Реализуй `POST /api/cron/analysis/run`:
   - Authorization: Bearer CRON_SECRET
   - RuntimeLock lease name `analysis.run`
   - selects PENDING analyses
   - marks RUNNING
   - calls mock/stub FastAPI AI endpoint or local mock processor today
   - validates response schema
   - stores COMPLETED or FAILED
   - safe summary response
5. AIAnalysis status handling:
   - PENDING
   - RUNNING
   - COMPLETED
   - FAILED
6. Invalid JSON/invalid schema -> FAILED with safe errorMessage.
7. Duplicate request with same kind/inputHash/promptVersion should not create noisy duplicate.
8. UI status on tender card:
   - no analysis
   - pending
   - running
   - completed
   - failed
9. Add tests:
   - request creates pending analysis
   - duplicate request reuses existing analysis
   - cron marks running/completed
   - invalid response marks failed
   - unauthorized cron rejected
   - ownership rejected.

Жесткие ограничения:
- Не делать final LLM prompt production сегодня.
- Не делать document diff today.
- Не скрывать OCR_REQUIRED as analyzed.
- Не писать AI state из FastAPI.
- Не ломать scoring/alerts.

Acceptance criteria:
- User can request analysis for owned tender.
- Pending analysis is processed by cron into completed/failed using validated mock response.
- Duplicate requests are idempotent.
- Tender card shows honest analysis state.
- Tests cover lifecycle.

После реализации верни:
- lifecycle summary;
- inputHash strategy;
- cron behavior;
- tests/checks run;
- what is mock vs ready for real LLM.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 17.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только AIAnalysis lifecycle, cron route, request actions, UI status and tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. requestTenderAnalysis делает auth/ownership.
2. inputHash deterministic.
3. Duplicate same kind/inputHash/promptVersion не создает шум.
4. OCR_REQUIRED/missing text не анализируется как completed.
5. analysis/run защищен CRON_SECRET и RuntimeLock.
6. Invalid response -> FAILED, not crash.
7. FastAPI не пишет AIAnalysis в DB.
8. UI states честные.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий pending -> completed/failed.
```

## Daily result log

```md
# 2026-06-16

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать AIAnalysis lifecycle и analysis cron.

## Done
-

## Checks
-

## Evidence
- Request analysis:
- Cron analysis run:
- Completed/failed status:

## Decisions
-

## Blockers
-

## Next day input
Day 18 должен реализовать extractive AI endpoints и strict schema/source_spans.
```

