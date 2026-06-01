# Day 20: 2026-06-19 - Release hardening and MVP demo

## Goal

Закрыть Sprint 04 и MVP: финальный QA, контрольная AI-выборка, release checklist, staging/pilot readiness, weekly demo notes и список must-fix перед production.

## Implementation prompt

```text
Ты senior release engineer/product QA lead. Сегодня Day 20 Sprint 04 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код/checklists/progress docs/tests/env examples.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Sprint 04 days 16-19 должны были добавить extraction, AIAnalysis lifecycle, extractive AI endpoints, AI panel and file proxy.
- Sprint 01-03 уже дали product skeleton, real source pipeline, board, scoring and alerts.

Задача дня: release hardening and MVP demo.

Сделай только это:
1. Прогони full relevant checks:
   - npm test
   - npm run typecheck
   - FastAPI tests
   - lint/build if available and not too expensive
2. Проверь MVP demo path:
   - login
   - create/run watchlist
   - tender appears
   - tender card normalized
   - sourceStage/source freshness visible
   - board move
   - checklist progress
   - rescore decision
   - alerts/run duplicate-safe
   - document extraction
   - request/run AI analysis
   - AI panel with source_spans
   - file proxy access
3. Собери AI control sample:
   - 10-15 documents/tenders if available;
   - if live docs unavailable, use fixture set and explicitly mark limitation.
4. Check release criteria:
   - no fake AI summary
   - OCR_REQUIRED honest
   - no sensitive alert payloads
   - file proxy ownership-safe
   - cron routes protected
   - runtime locks working
   - duplicate watchlist/alerts safe
5. Создай/обнови `docs/progress/week-04-demo.md`:
   - Sprint 04 status DONE/PARTIAL/BLOCKED
   - full demo path
   - tests/checks
   - AI sample results
   - mock/live status for provider, LLM, alerts
   - known risks
   - must-fix before pilot
   - rollback notes
6. Создай `docs/progress/mvp-release-candidate.md`:
   - что входит в MVP
   - что не входит
   - env needed
   - deploy order
   - pilot acceptance
   - first 48h monitoring checklist
7. Update `.agent-state/handoff.md` with current runtime and next recommended action.

Жесткие ограничения:
- Не добавлять новые product features today.
- Не скрывать fixture/mock/live limitations.
- Не claim production readiness if live provider/LLM/alerts unverified.
- Не коммитить secrets.
- Не ломать previous sprint flows.

Acceptance criteria:
- Sprint 04 status зафиксирован.
- MVP release candidate doc создан.
- Full demo path documented.
- Release blockers separated from follow-ups.
- Tests/checks run or skipped with explicit reason.

После реализации верни:
- Sprint 04 status;
- MVP readiness status;
- tests/checks summary;
- blockers before pilot;
- next recommended action.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 20 и готовность MVP release candidate.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только release docs, key flows, security checks and test results.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Full MVP demo path documented and reproducible.
2. Release docs honestly mark mock/live limitations.
3. AI sample has source_spans and unknowns.
4. OCR_REQUIRED/FAILED honest.
5. Cron routes protected.
6. Runtime locks still working.
7. File proxy ownership-safe.
8. Alerts no sensitive payload and no duplicates.
9. Tests/checks are recorded.
10. Pilot blockers are explicit.

Ответ:
- Findings first.
- Затем Sprint 04 status: DONE/PARTIAL/BLOCKED.
- Затем MVP readiness: READY_FOR_PILOT / PARTIAL / BLOCKED.
- Затем must-fix before pilot.
```

## Daily result log

```md
# 2026-06-19

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Закрыть Sprint 04 and MVP release candidate.

## Done
-

## Checks
-

## Evidence
- Full demo path:
- AI control sample:
- Release candidate doc:

## Decisions
-

## Blockers
-

## Sprint 04 result
DONE | PARTIAL | BLOCKED

## MVP readiness
READY_FOR_PILOT | PARTIAL | BLOCKED

## Next action
Pilot deployment/staging smoke test.
```

