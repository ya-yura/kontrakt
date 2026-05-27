# Day 15: 2026-06-12 - Alert adapters and weekly operational demo

## Goal

Добавить реальные или staging-safe Telegram/email adapters, закрыть Sprint 03 demo path и зафиксировать готовность operational loop.

## Implementation prompt

```text
Ты senior full-stack/release-minded engineer. Сегодня Day 15 Sprint 03 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web alerts/adapters/env/tender card/board/tests и docs/progress.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 14 должен был добавить AlertDelivery, idempotency и mock delivery.
- Board, checklist, scoring уже работают.

Задача дня: adapters + Sprint 03 demo.

Сделай только это:
1. Добавь alert delivery adapters:
   - Email adapter через выбранный provider или safe stub, если provider key отсутствует
   - Telegram adapter через bot token или safe stub, если token отсутствует
2. Adapters должны:
   - не отправлять вложения
   - не отправлять raw payload/sourcePayload/AI raw response
   - отправлять только номер, заказчик, событие, дедлайн, deep link
   - возвращать typed result
3. Env:
   - TELEGRAM_BOT_TOKEN
   - EMAIL_PROVIDER_API_KEY
   - ALERT_DELIVERY_MODE=mock|live
   - APP_BASE_URL
4. `alerts/run` должен использовать adapters по user preferences:
   - notifyEmail
   - notifyTelegram
   - alertPreferences если уже есть
5. Если live secrets отсутствуют:
   - режим mock остается валидным
   - в weekly demo честно указать, что live sending не проверен
6. UI:
   - alert history показывает channel, type, sentAt/error
   - no sensitive payload in UI by default
7. Подготовь `docs/progress/week-03-demo.md`:
   - demo path: tenders -> board -> move -> checklist -> rescore -> alerts/run -> alert history
   - что работает
   - что mock/live
   - тесты
   - known risks
   - must-fix перед Sprint 04
8. Прогони Sprint 03 acceptance:
   - card moves
   - checklist persists
   - score explainable
   - deadline/new_match alerts no duplicates
   - safe message text

Жесткие ограничения:
- Не делать AI/document parsing.
- Не отправлять чувствительные данные.
- Не требовать live Telegram/email для DONE, если mock mode явно зафиксирован и adapters готовы.
- Не ломать idempotency.

Acceptance criteria:
- Mock adapters работают и записывают AlertDelivery.
- Live adapters готовы к env secrets или честно помечены unverified.
- Alert text safe and short.
- Sprint 03 demo path проходит.
- Weekly demo notes созданы.
- Sprint 03 status зафиксирован DONE/PARTIAL/BLOCKED.

После реализации верни:
- adapters summary;
- demo path;
- tests/checks run;
- Sprint 03 status;
- recommended first task for Sprint 04.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 15 и готовность Sprint 03.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только alert adapters, env examples, alert history, weekly demo notes и Sprint 03 acceptance.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Telegram/email adapters не отправляют sensitive payload.
2. Missing secrets переводят delivery в safe stub/mock, а не падают raw error.
3. Alert text содержит только safe metadata and deep link.
4. Idempotency сохранилась после adapters.
5. Alert history показывает success/error.
6. Demo path проходит: board -> move -> checklist -> scoring -> alerts.
7. Weekly demo notes честно фиксируют mock/live статус.
8. Нет AI/document parsing вне scope.

Ответ:
- Findings first.
- Затем Sprint 03 status: DONE/PARTIAL/BLOCKED.
- Затем must-fix перед Sprint 04.
```

## Daily result log

```md
# 2026-06-12

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Добавить alert adapters и закрыть Sprint 03 demo.

## Done
-

## Checks
-

## Evidence
- Alert delivery mode:
- Alert text:
- Demo path:
- Weekly demo notes:

## Decisions
-

## Blockers
-

## Sprint 03 result
DONE | PARTIAL | BLOCKED

## Sprint 04 first task
Начать с document text extraction: TEXT_READY/OCR_REQUIRED/FAILED без fake AI summary.
```

