# Daily prompts: Week 04, 2026-06-15 to 2026-06-19

Эта папка содержит готовые ежедневные задачи-промпты для четвертой недели реализации MVP. Неделя соответствует `sprints/sprint-04-ai-release.md`: document extraction, AI-summary, file proxy, финальный QA и готовность к пилотному релизу.

## Исходное состояние после Sprint 03

Считаем, что Sprint 03 завершен и зафиксирован:

- board и `moveTenderToStage` работают;
- checklist state, progress и owner comments работают;
- rule-based scoring v1 сохраняет explainable `bid/review/no-bid`;
- alert engine, `AlertDelivery`, idempotency и `alerts/run` работают;
- Email/Telegram adapters безопасно обрабатывают missing secrets и network exceptions;
- mock/stub delivery явно отображается в alert history;
- `sourceStage` и `kanbanStage` остаются независимыми;
- `.agent-state/runtime-status.json` используется перед запуском серверов.

## Недельная цель

К пятнице, 2026-06-19, MVP должен уметь извлекать текст документов, честно показывать `TEXT_READY/OCR_REQUIRED/FAILED`, запускать extractive AI-summary с `source_spans`, показывать risks/unknowns/required documents в карточке, защищать file proxy и пройти release checklist на staging/pilot readiness.

## Важно про экономию токенов

Daily prompt уже содержит нужный статичный контекст. Не просите агента заново читать `deep-research-report.md`, sprint-файлы и весь `mvp-implementation-pack-223fz`.

Агент должен:

- принять prompt как источник истины;
- читать только релевантный код;
- перед запуском серверов проверять `.agent-state/runtime-status.json`;
- использовать уже запущенный URL, если сервис отвечает;
- открывать статичные документы только при противоречии или явной просьбе.

## Файлы недели

- `day-16-2026-06-15-document-extraction.md`
- `day-17-2026-06-16-ai-analysis-lifecycle.md`
- `day-18-2026-06-17-extractive-ai-endpoints.md`
- `day-19-2026-06-18-ai-panel-file-proxy.md`
- `day-20-2026-06-19-release-hardening-demo.md`

## Правило фиксации

Каждый день должен закончиться одним статусом:

- `DONE`: задача работает, проверки запущены, результат записан.
- `PARTIAL`: часть работает, известен список недоделок.
- `BLOCKED`: есть конкретный блокер и следующий шаг.

