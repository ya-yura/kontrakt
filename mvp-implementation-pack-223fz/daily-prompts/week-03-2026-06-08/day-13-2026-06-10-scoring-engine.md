# Day 13: 2026-06-10 - Rule-based bid/no-bid scoring

## Goal

Реализовать explainable scoring engine v1: `scoreTotal`, `scoreConfidence`, breakdown по пяти категориям, hard blockers и manual decision override.

## Implementation prompt

```text
Ты senior product/backend engineer. Сегодня Day 13 Sprint 03 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web scoring, Prisma, tender actions, tender card и tests.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Tenders уже подтягиваются и имеют нормализованные поля.
- Checklist/owner comments работают.
- AIAnalysis может быть пустым; scoring v1 должен работать без AI, используя доступные Tender fields и User.companyProfile/scoringPolicy.

Задача дня: scoring engine v1.

Сделай только это:
1. Реализуй `src/lib/scoring/bidNoBid.ts` или существующий scoring module.
2. Formula:
   - fit: 0-30
   - economics: 0-20
   - execution: 0-20
   - compliance: 0-20
   - urgency: 0-10
3. Thresholds:
   - scoreTotal >= 70 -> BID
   - 50..69 -> REVIEW
   - < 50 -> NO_BID
4. Hard blockers:
   - required license/certificate unavailable
   - unsupported region
   - security amount above company limit
   - preparation window below minimum
   - unacceptable payment terms
   - mandatory experience/reference unreachable
5. `scoreConfidence` отдельно от `scoreTotal`.
   - Если нет AIAnalysis/requirements или key docs missing, confidence ниже.
   - Если confidence < 60, итог не может быть BID; максимум REVIEW.
6. Сохраняй:
   - scoreTotal
   - scoreFit
   - scoreEconomics
   - scoreExecutionRisk
   - scoreComplianceRisk
   - scoreUrgency
   - scoreConfidence
   - scoreBreakdown JSON
   - decision
   - decisionReason
   - lastScoredAt
7. Реализуй Server Functions:
   - rescoreTender(tenderId)
   - setTenderDecision(tenderId, decision, reason)
8. Каждая mutation:
   - auth()
   - Zod validation
   - ownership check
   - typed ActionResult
   - revalidatePath board/card
9. UI:
   - tender card показывает пять полос breakdown
   - decision badge
   - decision reason
   - manual override form/button
   - board card показывает scoreTotal/decision
10. Добавь tests:
   - threshold table
   - hard blocker overrides high score
   - confidence < 60 prevents BID
   - unsupported region
   - security above limit
   - manual override ownership.

Жесткие ограничения:
- Не делать ML.
- Не вызывать LLM.
- Не делать alerts сегодня.
- Не смешивать scoreConfidence и scoreTotal.
- Не затирать manual override без явного rescore behavior.

Acceptance criteria:
- rescoreTender сохраняет explainable score.
- Hard blockers работают.
- Manual override работает с reason.
- UI показывает breakdown понятно.
- Тесты покрывают основные правила.

После реализации верни:
- scoring rules summary;
- измененные файлы;
- tests/checks run;
- known assumptions for companyProfile/scoringPolicy.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 13.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только scoring module, actions, UI и tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. Formula categories суммируются корректно.
2. Thresholds BID/REVIEW/NO_BID работают.
3. Hard blockers override high score.
4. confidence < 60 prevents BID.
5. scoreTotal и scoreConfidence не смешаны.
6. rescoreTender делает auth/ownership.
7. manual override требует reason и ownership.
8. UI показывает explanation, а не только число.
9. Нет ML/AI/alerts вне scope.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий scoring.
```

## Daily result log

```md
# 2026-06-10

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать rule-based bid/no-bid scoring.

## Done
-

## Checks
-

## Evidence
- Score breakdown:
- Hard blocker test:
- Manual override:

## Decisions
-

## Blockers
-

## Next day input
Day 14 должен реализовать AlertDelivery и idempotent alert engine без реальных адаптеров.
```

