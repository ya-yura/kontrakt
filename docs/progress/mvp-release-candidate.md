# MVP Release Candidate - Operational Workspace 223-FZ

Date: 2026-06-01

Status: RC-0 INTERNAL DEMO COMPLETE. MVP readiness is PARTIAL; pilot is BLOCKED_FOR_PILOT until live provider, live LLM, real alerts, and browser-click QA are verified.

## Included In MVP

- Dev-auth protected workspace shell.
- Saved filters/watchlists with protected manual and cron execution.
- EIS 223-FZ provider abstraction with deterministic fixture mode and live-mode configuration path.
- Normalized tender list and tender card.
- Source stage and source freshness visibility.
- Kanban board with owner-scoped stages and move action.
- Tender checklist and owner comment.
- Bid/no-bid scoring with manual override.
- Alert engine with idempotent delivery records and mock/live adapter boundaries.
- Document metadata, file proxy, and text extraction lifecycle.
- AIAnalysis request/run lifecycle.
- Extractive FastAPI AI endpoints with strict source-span validation and meaningful unknowns.
- AI panel that only treats source-backed facts as authoritative and shows OCR_REQUIRED honestly.
- Protected cron routes and runtime locks for watchlists, alerts, extraction, and analysis.

## Not Included

- Production auth/SSO and tenant administration.
- Guaranteed live EIS coverage or SLA.
- OCR implementation for scanned PDFs.
- Production LLM quality approval.
- Real email/Telegram delivery approval.
- Automated browser e2e suite.
- Legal advice or automated bid/no-bid final decisioning.
- Object storage production hardening beyond current proxy/ownership guardrails.
- Multi-user team workflows beyond owner-scoped MVP paths.

## Environment Needed

Required local/deploy env:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DEV_AUTH_USER_EMAIL`
- `DEV_AUTH_USER_NAME`
- `CRON_SECRET`
- `APP_BASE_URL`
- `FASTAPI_BASE_URL`
- `FASTAPI_INTERNAL_TOKEN`
- `FASTAPI_TIMEOUT_SECONDS`
- `WATCHLIST_LOCK_TTL_SECONDS`
- `EIS_PROVIDER_MODE`
- `EIS_PROVIDER_BASE_URL` and `EIS_PROVIDER_API_KEY` for live EIS mode
- `AI_PROVIDER_MODE`
- `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL` for live LLM mode
- `AI_ANALYSIS_PROCESSOR`
- `AI_ANALYSIS_PROVIDER_MODE`
- `AI_ANALYSIS_MODEL`
- `ALERT_DELIVERY_MODE`
- `TELEGRAM_BOT_TOKEN` and safe `TELEGRAM_CHAT_ID` or user chat preference for Telegram live mode
- `EMAIL_PROVIDER_API_KEY` and safe pilot recipient/from configuration for email live mode
- `FILE_STORAGE_ROOT` when serving local/object-storage-backed files through the proxy
- Object storage env when real storage is introduced: `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`

Do not commit real secrets. `.env.example` contains placeholders only.

## Local Environment Readiness - Day 22

Verified at 2026-06-02 00:44 +03 and recorded in `.agent-state/runtime-status.json`.

- Web: `http://localhost:3103`, PID 16864, reused existing Next dev server; `/api/healthz` returned 200 `{"status":"ok","service":"web"}`.
- API: `http://127.0.0.1:8001`, PID 3712, reused existing Uvicorn process; `/healthz` returned 200 with EIS provider `fixture`.
- Postgres: `postgres://localhost:15439`, canonical Docker Compose container `operational-workspace-postgres`, `pg_isready` accepting connections.
- Postgres port policy: use local host port `15439`. Port `5432` is avoided because this workstation runs multiple local databases. The prior repo-specific `5439` is inside the Windows excluded TCP range `5341-5440`, so Docker cannot bind it reliably. The policy is set in `docker-compose.yml` and mirrored by `DATABASE_URL`/`DIRECT_URL` in `.env.example`.
- Stale service note: temporary container `operational-workspace-postgres-day20` was stopped after compose Postgres was recreated on `15439`; agents should not start a second Postgres on another port while the registry service is healthy.
- Clean startup sequence verified: Postgres compose service, FastAPI health, Next web health.
- Cron auth on current runtime: all four cron POST routes return 401 for missing auth and 403 for `Authorization: Bearer definitely-wrong-token`.
- RuntimeLock verification: `SELECT COUNT(*) FROM "RuntimeLock"` returned 0 after checks.
- Config-touch check: `npm run typecheck -w apps/web` passed.

## Live EIS Smoke - Day 23

Verified at 2026-06-02. Detailed log: `docs/progress/live-eis-smoke.md`.

- Live EIS status: BLOCKED by missing live EIS credentials. `EIS_PROVIDER_MODE`, `EIS_PROVIDER_BASE_URL`, and `EIS_PROVIDER_API_KEY` were not present in the current process or local env files; no values were printed.
- FastAPI runtime remained honest fixture mode: `/healthz` returned `provider.mode=fixture`.
- Fixture fallback passed search/normalize DTO checks with explicit fixture `sourceFreshness`.
- Controlled Next watchlist route handler run used one temporary smoke filter and `WATCHLIST_SEARCH_LIMIT=3`; repeat run created no duplicate tenders or documents.
- Existing pending Prisma migrations were applied to the local dev DB before the clean route run: alert engine core, document text extraction, and AI analysis lifecycle.
- Live document extraction: `BLOCKED_BY_MISSING_LIVE_EIS`. Fixture/control documents prove pipeline behavior only; no live EIS PDFs/documents were fetched or extracted.

## Deploy Order

1. Provision Postgres and confirm the app can connect.
2. Apply Prisma migrations.
3. Deploy FastAPI service.
4. Verify FastAPI `/healthz` and provider mode.
5. Deploy Next.js web service.
6. Verify web `/api/healthz`.
7. Seed only approved deterministic demo data if this is an internal demo environment.
8. Configure provider modes:
   - demo: `EIS_PROVIDER_MODE=fixture`, `AI_PROVIDER_MODE=mock`, `ALERT_DELIVERY_MODE=mock`;
   - pilot: live modes only after credentials and safe delivery channels are verified.
9. Enable cron routes after `CRON_SECRET` and runtime locks are verified.
10. Run smoke checks in this order: watchlist run, duplicate watchlist run, tenders list, tender card, board move, checklist update, rescore, extraction, AI request/run, alerts run twice, file proxy owned access, file proxy cross-owner denial.

## Current Verification Gates

| Gate | Current status | Pilot requirement |
| --- | --- | --- |
| EIS provider | BLOCKED: missing live EIS credentials. Fixture fallback verified on Day 23; controlled Next watchlist repeat produced no duplicates; live upstream not exercised | Live credentials and 10-15 real tender/document smoke |
| Live document extraction | BLOCKED_BY_MISSING_LIVE_EIS. Fixture/control extraction states are verified, but live EIS documents were not available | Live EIS credentials, real document download, file proxy, and text extraction against real PDFs |
| LLM/AI provider | Mock extractive path verified with citations and unknowns | Live LLM credentials and approved source-backed sample |
| Email | Mock delivery/idempotency verified | Safe pilot email provider credentials and recipient |
| Telegram | Mock/stub behavior covered | Safe bot token and pilot chat/channel |
| Browser-click QA | BLOCKED by local `node_repl` ESM/CommonJS startup failure | Full click-through path on deployed URL |
| Cron auth | PASS, all four routes return safe 401/403 | Preserve in deployed runtime |
| File proxy ownership | PASS, test + live-like cross-owner 404 | Repeat against pilot data/storage |

## Pilot Acceptance

Pilot can start only when all of these are true:

- Full checks pass: web tests, web typecheck, web build, FastAPI tests, API lint.
- Live provider returns real tenders and source freshness is shown honestly.
- Live document extraction is verified on real EIS documents; fixture/control documents are not sufficient for this gate.
- At least 10-15 real documents/tenders pass the AI control sample or are explicitly marked unavailable.
- OCR_REQUIRED is shown for scanned/non-text PDFs; no fake text or fake summaries are generated.
- AI panel displays only source-backed facts with source spans and meaningful unknowns when fields are absent.
- File proxy denies cross-owner access and untrusted redirects in live-like data.
- Alerts are duplicate-safe and send only non-sensitive payloads to approved channels.
- Protected cron routes reject missing/wrong auth and run with runtime locks.
- Browser-click QA covers the full demo path on the deployed URL.
- Known blockers are either fixed or explicitly accepted by the pilot owner.

## First 48h Monitoring Checklist

- Watch FastAPI health and provider error rates.
- Watch Next.js route errors for `/watchlists`, `/tenders`, `/board`, `/tenders/[id]`, cron routes, and file proxy.
- Review every cron run summary: processed counts, created/updated counts, failures, lock conflicts.
- Check duplicate tender/document creation after repeated watchlist runs.
- Review document extraction statuses: TEXT_READY, OCR_REQUIRED, FAILED.
- Review AIAnalysis statuses: PENDING stuck, RUNNING stuck, FAILED, COMPLETED without valid source spans or without unknowns on incomplete inputs.
- Review alert delivery records for duplicate idempotency keys, safe payload shape, and delivery failures.
- Confirm no secrets appear in logs, health responses, alert payloads, or file proxy responses.
- Confirm users cannot access another user's tender, document, alert, analysis, or file.
- Keep rollback ready: disable cron, switch integrations to fixture/mock, and revert web/API artifact if needed.

## Current RC Decision

MVP is internally demoable with fixture/mock limitations. It is not pilot-ready today because live EIS credentials are missing, live document extraction is `BLOCKED_BY_MISSING_LIVE_EIS`, and live EIS, live LLM, live alert delivery, and browser-click QA remain unverified.
