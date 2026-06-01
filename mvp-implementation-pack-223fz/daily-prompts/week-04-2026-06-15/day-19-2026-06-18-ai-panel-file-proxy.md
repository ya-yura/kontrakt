# Day 19: 2026-06-18 - AI panel and secure file proxy

## Goal

Показать AI-summary в карточке закупки и закрыть безопасный доступ к документам через `GET /api/files/[documentId]`.

## Implementation prompt

```text
Ты senior Next.js/security-minded frontend engineer. Сегодня Day 19 Sprint 04 MVP Operational Workspace по 223-ФЗ.

Режим экономии контекста:
- Этот prompt самодостаточен. Не перечитывай deep-research-report.md и mvp-implementation-pack-223fz через shell.
- Читай только релевантный код apps/web tender card, file route, AIAnalysis queries, actions, UI components and tests.
- Перед запуском любого сервера проверь `.agent-state/runtime-status.json`; если нужный сервис уже `running` и URL отвечает, используй его, а не запускай новый порт.
- После запуска/остановки/проверки долгоживущего процесса обнови `.agent-state/runtime-status.json`.
- Открывай статичные markdown-документы только если prompt неполный или противоречивый.

Исходное состояние:
- Day 18 должен был добавить extractive AI endpoints and validation.
- Tender card уже показывает details, checklist, scoring, alerts.
- Document metadata exists.

Задача дня: AI panel + file proxy.

Сделай только это:
1. На tender card добавь AI panel:
   - status: no analysis / pending / running / completed / failed / OCR_REQUIRED / text not ready
   - summaryMd
   - required documents
   - critical risks
   - deadlines
   - evaluation criteria
   - unknowns
   - citations/source spans
   - confidence
2. UI должен явно показывать:
   - какие документы анализировались;
   - какие документы OCR_REQUIRED/FAILED;
   - что AI extractive and needs human review.
3. Добавь actions/buttons:
   - Request AI analysis
   - Refresh AI analysis
   - disabled/tooltip states when text not ready/OCR required.
4. Реализуй `GET /api/files/[documentId]`:
   - auth()
   - document ownership via tender owner
   - no arbitrary URL proxy
   - safe content type
   - no signed URL/secrets in logs/response
   - handles missing storage/fileUrl safely.
5. Document list should link through file proxy, not raw external URL, if file proxy is intended.
6. Add tests:
   - user cannot access another user's document
   - missing document 404
   - file proxy does not accept arbitrary URL
   - AI panel renders completed analysis
   - AI panel renders OCR_REQUIRED/FAILED states
   - no source_spans fact hidden as authoritative.

Жесткие ограничения:
- Не делать new AI backend logic today except calling existing actions.
- Не show fake summary for OCR_REQUIRED documents.
- Не expose raw fileUrl if proxy is required.
- Не send attachments in alerts.
- Не remove scoring/alerts/checklist UI.

Acceptance criteria:
- User sees useful AI panel on tender card.
- AI panel is honest about missing/OCR/failed docs.
- Citations/source spans visible.
- File proxy ownership-safe.
- Document links do not leak secrets.

После реализации верни:
- AI panel behavior;
- file proxy security behavior;
- tests/checks run;
- UI limitations before release.
```

## QA prompt

```text
Ты QA/reviewer агент. Проверь результат Day 19.

Режим экономии контекста:
- Этот QA prompt самодостаточен. Не перечитывай статичные markdown-документы через shell.
- Проверяй только tender card AI panel, file proxy route, actions and tests.
- Перед запуском/проверкой сервера посмотри `.agent-state/runtime-status.json` и используй уже запущенный URL, если он отвечает.

Проверь:
1. File proxy checks auth and tender ownership.
2. File proxy cannot fetch arbitrary URL from request.
3. Signed URLs/secrets not logged or returned.
4. AI panel shows source_spans/citations.
5. OCR_REQUIRED/FAILED states do not show fake summary.
6. Request/refresh analysis respects text readiness.
7. User cannot see another user's documents/analysis.
8. Existing scoring/alerts/checklist UI still present.

Ответ дай findings-first. Если блокеров нет, дай manual QA сценарий card + file proxy.
```

## Daily result log

```md
# 2026-06-18

## Day status
DONE | PARTIAL | BLOCKED

## Goal
Реализовать AI panel и secure file proxy.

## Done
-

## Checks
-

## Evidence
- AI panel completed:
- OCR_REQUIRED state:
- File proxy ownership:

## Decisions
-

## Blockers
-

## Next day input
Day 20 должен закрыть release hardening, control AI sample и MVP demo.
```

