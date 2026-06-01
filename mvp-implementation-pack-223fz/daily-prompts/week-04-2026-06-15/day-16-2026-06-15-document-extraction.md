# Day 16: 2026-06-15 - Document text extraction

## Goal

Реализовать базовый pipeline извлечения текста документов: FastAPI `/v1/documents/extract-text`, статусы `TEXT_READY/OCR_REQUIRED/FAILED`, сохранение `textContent`, `textChecksum`, `pageCount`, `hasTextLayer` через Next.js analysis cron или manual action.

## Implementation prompt

```text
Ты senior Python/Next.js integration engineer. Сегодня Day 16, первый день Sprint 04 MVP Operational Workspace для поставщика по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/api documents/router/services/schemas и apps/web documents/analysis cron/Prisma client.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Sprint 03 завершен: board, checklists, scoring и alerts работают.
- FastAPI остается stateless compute service и не пишет бизнес-состояние в PostgreSQL.
- Next.js остается единственным writer через Prisma.
- Document model уже содержит extractionStatus, textContent, textChecksum, pageCount, hasTextLayer.

Задача дня: text extraction foundation.

Сделай только это:
1. В apps/api реализуй endpoint `POST /v1/documents/extract-text`.
2. Request DTO:
   - documentId или externalDocumentId для tracing
   - fileUrl или storageKey/signed URL, если уже есть
   - fileName
   - mimeType
   - maxPages optional
3. Response DTO:
   - status: TEXT_READY|OCR_REQUIRED|FAILED
   - text: string|null
   - textChecksum: string|null
   - pageCount: number|null
   - hasTextLayer: boolean|null
   - metadata: object
   - errorMessage: string|null
4. Реализуй extraction service:
   - для PDF с text layer вернуть TEXT_READY;
   - для scanned/empty text вернуть OCR_REQUIRED;
   - для unsupported/failed вернуть FAILED с safe errorMessage.
5. OCR пока может быть stub/future path: не симулируй текст, если OCR не реализован.
6. В apps/web добавь FastAPI client method для extract-text и Zod validation response.
7. Добавь минимальный analysis cron/manual service, который:
   - выбирает Documents со статусом PENDING/DOWNLOADED/OCR_REQUIRED по текущей логике;
   - вызывает extract-text;
   - сохраняет extractionStatus, textContent, textChecksum, pageCount, hasTextLayer, metadata;
   - не запускает LLM сегодня.
8. Добавь tests:
   - text PDF fixture -> TEXT_READY;
   - scanned/empty fixture -> OCR_REQUIRED;
   - bad/unsupported -> FAILED;
   - Next.js save path updates Document safely.

Жесткие ограничения:
- Не делать AI-summary сегодня.
- Не подделывать OCR result.
- FastAPI не пишет в DB.
- Не отправлять документы в LLM.
- Не ломать existing alert/scoring flows.

Acceptance criteria:
- Text extraction endpoint работает в fixture/local file mode.
- UI/DB status не показывает fake summary.
- OCR_REQUIRED явно сохраняется и виден в данных.
- Failed extraction возвращает safe error.
- Tests покрывают три статуса.

После реализации верни:
- endpoint contract;
- extraction libraries/approach;
- tests/checks run;
- known OCR limitations.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 16.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только document extraction endpoint/service, Next client/save path и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. FastAPI не пишет в PostgreSQL.
2. TEXT_READY/OCR_REQUIRED/FAILED различаются честно.
3. OCR_REQUIRED не содержит fake text.
4. textChecksum стабилен.
5. Safe errorMessage не содержит secrets/signed URLs.
6. Next.js сохраняет extraction fields через Prisma.
7. Нет LLM/AI summary вне scope.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий для text/scanned/bad fixtures.
```

## Daily result log

```md
# 2026-06-15

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать document text extraction и статусы TEXT_READY/OCR_REQUIRED/FAILED.

## Done
-

## Checks
-

## Evidence
- TEXT_READY fixture:
- OCR_REQUIRED fixture:
- FAILED fixture:

## Decisions
-

## Blockers
-

## Next day input
Day 17 должен реализовать AIAnalysis lifecycle без LLM production assumptions.
```

