# Week 04 Demo - Sprint 04 MVP Operational Workspace 223-FZ

Date: 2026-06-01

## Sprint 04 Status

Status: DONE for internal MVP demo with fixture/mock integrations.

MVP readiness: PARTIAL. Pilot is BLOCKED_FOR_PILOT until live EIS, live LLM, real alert delivery, and real browser-click QA are verified. This is not production readiness.

Day 20 hotfix result:

- Fixed the live cron runtime blocker on `POST /api/cron/documents/extract-text`. The route now validates cron auth before loading the document extraction runner.
- Cleaned `.next`, ran a successful Next build, restarted the web dev server on the same port, and reverified the route on the fresh runtime.
- Added a meaningful AI control sample with citations/source spans and non-empty `unknowns`.
- Preserved an honest `OCR_REQUIRED` document in the runtime/demo sample.
- Verified file proxy owned access and cross-owner denial with live-like DB rows.

## Full Demo Path

Runtime URL: `http://localhost:3103`.

1. Login/dev auth: PASS. Rendered pages include `dev.supplier@example.local`.
2. Create/run watchlist: PASS. Protected watchlist cron is available and duplicate-safe; web tests cover repeated upsert without duplicate tenders/documents.
3. Tender appears: PASS. `/tenders` returned 200 and rendered fixture/demo tenders.
4. Tender card normalized: PASS. `/tenders/cmpviequ10009zcyctevazhig` returned 200 and rendered normalized tender sections.
5. `sourceStage`/source freshness visible: PASS. `/board` and tender pages render source/work stage data; fixture/live status remains explicit.
6. Board move: PASS by automated service tests. Browser-click execution is blocked by the Browser tool issue below.
7. Checklist progress: PASS. `/board` and `/tenders/day20-ai-unknowns-tender` returned 200; rendered smoke saw checklist content. Automated checklist tests passed.
8. Rescore decision: PASS by automated scoring tests and rendered tender scoring panel.
9. Alerts/run duplicate-safe: PASS. Safe mock smoke:
   - Run #1 after adding the Day 20 sample: `deliveriesCreated=1`, `duplicatesSkipped=9`.
   - Run #2: `deliveriesCreated=0`, `duplicatesSkipped=10`.
   - DB has 10 alert rows and 10 distinct `idempotencyKey` values.
10. Document extraction: PASS for text-layer fixture/control documents and safe failure states only. Live document extraction is not ready and is `BLOCKED_BY_MISSING_LIVE_EIS`. OCR itself is not implemented.
11. Request/run AI analysis: PASS. `day20-ai-unknowns-analysis` completed through protected `POST /api/cron/analysis/run`.
12. AI panel with source spans: PASS. `/tenders/day20-ai-unknowns-tender` rendered AI panel content with completed analysis, `Unknowns`, citations/source spans, and OCR state.
13. File proxy access: PASS.
   - Owned document `cmpvieqv3000azcycguggwtea`: `GET /api/files/cmpvieqv3000azcycguggwtea` returned 200 `text/plain`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
   - Cross-owner document `day20-foreign-doc`: `GET /api/files/day20-foreign-doc` returned 404 `{"error":"Document not found."}`.

Browser-click QA: BLOCKED by local tool/runtime. The in-app Browser plugin could not initialize because `node_repl` crashed before page control:

```text
node_repl kernel exited unexpectedly
ReferenceError: require is not defined in ES module scope
C:\package.json contains "type": "module"
```

Fallback evidence completed after the clean restart: live HTTP rendered `/watchlists`, `/tenders`, `/board`, `/tenders/day20-ai-unknowns-tender`, `/tenders/cmpviequ10009zcyctevazhig`; file proxy owned/cross-owner checks were repeated on the fresh web PID.

## Cron Route Auth Results

Fresh runtime after clean build/restart:

| Route | Missing auth | Wrong token | Safe summary |
| --- | ---: | ---: | --- |
| `/api/cron/watchlists/run` | 401 | 403 | yes |
| `/api/cron/analysis/run` | 401 | 403 | yes |
| `/api/cron/alerts/run` | 401 | 403 | yes |
| `/api/cron/documents/extract-text` | 401 | 403 | yes |

The documents route no longer returns `Cannot find module './819.js'` on no-auth POST.

## Tests And Checks

- `npm test -w apps/web`: PASS, 69/69.
- `npm run typecheck -w apps/web`: PASS.
- `npm run build -w apps/web`: PASS, Next.js 15.5.18, including dynamic cron/file routes.
- `uv run pytest` in `apps/api`: PASS, 34/34.
- `uv run ruff check app tests` in `apps/api`: PASS.
- npm lint: SKIPPED, no npm lint script exists in `apps/web/package.json`. Next build ran its built-in lint/type validation.
- Targeted browser/manual QA: PARTIAL. Browser-click tool blocked; live HTTP rendered-page smoke and DB/API checks completed.

## Runtime Used

- Web: running at `http://localhost:3103`, PID `16864`, health `{"status":"ok","service":"web"}`.
- API: running at `http://127.0.0.1:8001`, health `service=api`, provider fixture.
- Postgres: temporary fallback container `operational-workspace-postgres-day20` on `localhost:15439`.

Reason for fallback DB port: the original compose port `5439` refused bind on this Windows machine. Runtime registry records the fallback.

## AI Control Sample

Fixture/mock sample only; live EIS PDFs and live LLM quality are not verified.

Primary Day 20 sample:

- Tender: `day20-ai-unknowns-tender`
- TEXT_READY document: `day20-ai-unknowns-doc`
- OCR_REQUIRED document: `day20-ocr-required-doc`
- Analysis: `day20-ai-unknowns-analysis`
- Provider/model: `fastapi-mock` / `mock-extractive-223fz-v1`
- Result: `COMPLETED`, `citations=1`, `summaryItems=1`, `unknowns=5`
- Unknown fields: `requirements`, `risks`, `deadlines`, `requestedDocuments`, `evaluationCriteria`
- Source text limitation: the only text-ready document says `Предмет закупки: поставка бумаги для офиса.`, so the missing fields are meaningful unknowns, not filler.

Additional fixture control slice from Day 20 remains available: 15+ TEXT_READY fixture documents across 5 tender analyses with source-backed outputs.

## OCR_REQUIRED / FAILED Representation

Runtime sample document:

- Document: `day20-ocr-required-doc`
- Tender: `day20-ai-unknowns-tender`
- State: `OCR_REQUIRED`
- Rendered page: `/tenders/day20-ai-unknowns-tender` returned 200 and included OCR-blocking copy.

No fake OCR text or fake AI summary was added for the scanned fixture. The AI runner used only `TEXT_READY` document text.

## Mock / Live Status

| Integration | Fixture/mock verified | Live verified | Missing for pilot |
| --- | --- | --- | --- |
| EIS provider | Yes, fixture mode via FastAPI/web | No | `EIS_PROVIDER_BASE_URL`, `EIS_PROVIDER_API_KEY`, 10-15 real tender/document smoke |
| Document extraction | Yes, fixture/control documents only | No; `BLOCKED_BY_MISSING_LIVE_EIS` | Live EIS credentials, real EIS PDF/document download, file proxy, text extraction smoke |
| LLM/AI provider | Yes, FastAPI mock extractive path | No | `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`, approved live prompt/output smoke |
| Email alerts | Yes, mock delivery/idempotency | No | `EMAIL_PROVIDER_API_KEY`, safe pilot recipient/channel |
| Telegram alerts | Yes, mock/stub behavior covered | No | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` or user chat preference, safe pilot chat |

## Release Criteria Check

- No fake AI summary: PASS. AI panel only treats source-backed output as authoritative.
- OCR_REQUIRED honest: PASS. OCR is not implemented and scanned/no-text documents stay blocked.
- No sensitive alert payloads: PASS for mock payload shape; no source URL/token/secret is exposed in checked payloads.
- File proxy ownership-safe: PASS. Automated test plus live-like `day20-foreign-doc` 404 denial.
- Cron routes protected: PASS. All four routes return safe 401/403 on missing/wrong auth.
- Runtime locks working: PASS by web test coverage for cron runners; no stuck locks observed during smoke.
- Duplicate watchlist/alerts safe: PASS by tests and alerts smoke.

## Known Risks

- Live EIS provider is unverified.
- Live document extraction is `BLOCKED_BY_MISSING_LIVE_EIS`; fixture/control documents do not prove live EIS PDF readiness.
- Live LLM provider is unverified.
- Real email/Telegram delivery is unverified.
- Browser-click QA is blocked by the local Browser plugin/node runtime failure.
- Local default Postgres port `5439` is unusable on this machine today; fallback `15439` was used.
- AI control sample is fixture/mock. It proves pipeline mechanics, citations, unknowns, and source-span enforcement, not production extraction quality.
- OCR is not implemented.

## Must Fix Before Pilot

1. Verify live EIS credentials and response contracts with at least 10-15 real tenders/documents.
2. After live EIS credentials exist, verify live document download, file proxy, and text extraction against real PDFs.
3. Run AI analysis with configured live LLM credentials or explicitly approve mock-only pilot scope.
4. Run alerts with real email/Telegram delivery in safe pilot channels and confirm payload minimization.
5. Fix or bypass the local Browser plugin/runtime issue and complete real browser-click QA.
6. Resolve the local Postgres port issue or approve the non-default runtime port/config.

## Rollback Notes

- Disable cron traffic first: watchlists, documents extraction, analysis, alerts.
- Switch `EIS_PROVIDER_MODE`, `AI_PROVIDER_MODE`, and `ALERT_DELIVERY_MODE` back to fixture/mock if live integrations misbehave.
- Revert web/API artifact to the previous passing build if cron or file routes regress.
- Runtime processes and ports are recorded in `.agent-state/runtime-status.json`.
