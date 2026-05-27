# Week 03 Demo Readiness - 223-ФЗ Operational Workspace

Date: 2026-05-27

Sprint 03 status: DONE

Reason: operational loop is demo-ready in mock mode. Board moves, checklist persistence, explainable scoring, alert idempotency, safe alert text, and alert history are covered by tests. Live Email/Telegram sending is implemented behind env config, but was not verified with real provider secrets.

## Demo Path

1. Open `/tenders` and choose an owned tender.
2. Open `/board`, drag or move the tender to another Kanban stage.
3. Open `/tenders/{id}` and update the stage checklist.
4. Click `Rescore` and verify score breakdown, confidence, and decision reason update.
5. Trigger `POST /api/cron/alerts/run` with the cron bearer token. Do not use browser GET for this POST-only route.
6. Refresh `/tenders/{id}` and verify alert history shows channel, type, created time, `sentAt`, acknowledgment state, and safe error text when present.

## What Works

- Kanban stage movement is owner-scoped and does not mutate `sourceStage`.
- Checklist state persists on the tender and keeps existing values when stage changes.
- Scoring v1 is explainable with fit, economics, execution risk, compliance risk, urgency, confidence, and decision reason.
- `alerts/run` creates `NEW_MATCH` and deadline bucket alerts with idempotency keys.
- Alert delivery adapters reserve `AlertDelivery` before attempting external delivery, so duplicate runs do not resend duplicate records.
- Saved filter delivery preferences support `notifyEmail`, `notifyTelegram`, and existing nested `alertPreferences`.
- Alert message text is short and safe: number, customer, event, deadline, and deep link only.
- Tender alert history does not render stored payloads by default.

## Mock / Live Boundary

- Default `ALERT_DELIVERY_MODE=mock` is valid for demo and records `AlertDelivery` without external sends.
- Email live path is ready for `EMAIL_PROVIDER_API_KEY`; missing key becomes a safe stub result.
- Telegram live path is ready for `TELEGRAM_BOT_TOKEN`; missing token becomes a safe stub result.
- Live Telegram also needs a recipient chat id from existing alert preferences/company profile or an operator-provided runtime env. Token alone is not enough to address a user.
- Live sending was not verified with real provider credentials in this run.

## Tests Run

- `npm test` in `apps/web`: 44 passed.
- `npm run typecheck` in `apps/web`: passed.

## Known Risks

- Email provider sender/domain verification is not covered by automated tests.
- Telegram recipient setup is not yet exposed in UI.
- Alert history shows provider/stub error text, but there is no retry workflow yet.
- `notifyOnChanges` is captured in preferences, but change/clarification alert generation is not part of Sprint 03.

## Must-Fix Before Sprint 04

- Verify live Email and Telegram delivery in a controlled non-production environment.
- Add explicit recipient preference UI for Telegram chat id and email channel opt-in/out.
- Add delivery retry/admin diagnostics without exposing payloads or provider secrets.
- Decide the Sprint 04 boundary for AI/document parsing separately from alert delivery.

First recommended Sprint 04 task: run a controlled live-delivery smoke test with real non-production Email/Telegram credentials and capture exact provider prerequisites.
