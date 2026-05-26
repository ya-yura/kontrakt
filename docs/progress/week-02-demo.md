# Week 02 Demo Readiness - 223-ФЗ Operational Workspace

Date: 2026-05-25

Sprint 02 status: PARTIAL

Reason: fixture-backed demo path is ready, but live validation is BLOCKED in the current environment because `EIS_PROVIDER_MODE`, `EIS_BASE_URL`, `EIS_API_KEY`, and `FASTAPI_BASE_URL` were not set in the shell used for Day 10 validation. Do not present fixture updates as live EIS updates.

## What Works

- FastAPI fixture search/normalize can feed normalized 223-ФЗ DTOs into Next.js/Prisma.
- Watchlist refresh is available from `/watchlists` per saved filter with auth, ownership check, typed `ActionResult`, lock handling, normalize, and upsert.
- Cron endpoint exists at `POST /api/cron/watchlists/run` with bearer auth and typed run summary.
- Tender upsert saves source freshness: `lastSeenAt`, `updatedFromSourceAt`, and `providerMode`.
- `sourceStage` is derived in Next.js from source documents and deadlines:
  - `SUBMISSION_OPEN` for notice/documentation with active deadline.
  - `COMMISSION_WORK` for protocol documents.
  - `COMPLETED` for result/final protocol documents.
  - `CANCELED` for cancellation markers.
  - `EXPIRED` for passed deadline without result.
  - `UNKNOWN` otherwise.
- `kanbanStageId` remains independent. Upsert does not move existing tenders between kanban stages.
- Tender list and tender card show source freshness and warn that upstream is not a real-time stream.

## Demo Path

1. Open `/watchlists`.
2. Use `Refresh` on an owned saved filter.
3. Open `/tenders`.
4. Verify each row shows price, deadline, customer, document count, sourceStage, kanbanStage, decision, and freshness.
5. Open a tender card at `/tenders/{id}`.
6. Verify sourceStage and KanbanStage are shown separately, with freshness fields and the non-real-time upstream notice.

## Control Sample

Requested target: 20 закупок.

Actual Day 10 validation: fixture-based control sample only. The available FastAPI fixture contains 3 purchases; live 20-purchase validation is BLOCKED until live EIS provider config/API key is available.

| Registry number | Price | Deadline | Customer | Documents | Derived sourceStage | Check |
| --- | ---: | --- | --- | ---: | --- | --- |
| 32413500001 | 1,850,000 RUB | 2026-06-03 10:00 +03:00 | АО "Городская стоматология" | 8 | COMPLETED | price, deadline, customer, documents, sourceStage checked from fixture |
| 32413500002 | 4,200,000 RUB | 2026-05-30 16:00 +03:00 | ГАУЗ "Областной клинический центр" | 0 | UNKNOWN | price, deadline, customer, documents, sourceStage checked from fixture |
| 32413500003 | 2,750,000 RUB | 2026-06-07 12:00 +03:00 | АО "Северная инфраструктура" | 0 | UNKNOWN | price, deadline, customer, documents, sourceStage checked from fixture |

Fixture reason: this dataset is deterministic and explicitly marked as not live EIS data. It is enough for UI/upsert/demo mechanics, not enough for live source completeness.

## Tests Run

- `npm test` in `apps/web`: 18 passed.
- `npm run typecheck` in `apps/web`: passed.
- `npm run db:generate` in `apps/web`: passed with temporary dummy `DATABASE_URL` because generation only needed config loading.

## Not In Sprint 02

- AI analysis.
- Scoring engine.
- Alerts.
- Automatic kanban movement.
- Real-time source stream semantics.
- Live EIS 20-purchase validation.

## Must-Fix Before Sprint 03

- Configure live EIS provider credentials/base URL and FastAPI base URL in the environment.
- Run a real 20-purchase search -> normalize -> upsert validation and compare price, deadline, customer, documents, and sourceStage.
- Re-run migrations against the development database after the sourceStage/freshness schema change.
- Decide whether live provider cancellation markers need extra sourcePayload parsing beyond status/document/change text.

First recommended Sprint 03 task: enable live provider config and validate 20 live 223-ФЗ purchases end-to-end through watchlist refresh into `/tenders`.
