# Live EIS Smoke - Day 23 Sprint 05

Date: 2026-06-02

Status: BLOCKED: missing live EIS credentials.

## Environment Check

Checked without printing values:

| Key | Status |
| --- | --- |
| `EIS_PROVIDER_MODE` | missing in current process; no local env file sets `live` |
| `EIS_PROVIDER_BASE_URL` | missing |
| `EIS_PROVIDER_API_KEY` | missing |

Recorded runtime state:

- FastAPI `http://127.0.0.1:8001/healthz`: `provider.mode=fixture`, `configured=true`.
- Next `http://localhost:3103/api/healthz`: `{"status":"ok","service":"web"}`.
- No live upstream call was made. Do not present this smoke as live EIS verification.

## Fixture Fallback

Fixture mode still works and is clearly marked:

- FastAPI search `POST /v1/eis223/search` with `limit=3`: `providerMode=fixture`.
- `sourceFreshness`: `mode=fixture`, `source=eis223_fixture`, `generatedAt=2026-05-25T00:00:00+03:00`, note says this is a local deterministic fixture dataset and not live EIS data.
- Normalize DTO path returned valid normalized DTOs for the control tenders.

## Live Document Extraction

Status: `BLOCKED_BY_MISSING_LIVE_EIS`.

- Live EIS credentials are missing, so no real EIS tender documents were fetched.
- Document extraction evidence is limited to fixture/control documents only.
- Do not claim live document extraction readiness until live EIS credentials exist and real EIS PDFs/documents are fetched through the live provider path.
- Existing `TEXT_READY`, `OCR_REQUIRED`, and `FAILED` checks prove pipeline behavior and honest UI states, not live EIS document readiness.

## Controlled Watchlist Run

Because the running Next server's `CRON_SECRET` value is not available in the current shell, the live HTTP endpoint was only auth-checked with missing auth and returned a safe 401 summary. The controlled run invoked the same Next route handler from `apps/web/app/api/cron/watchlists/run/route.ts` in a local process with a throwaway bearer token, `FASTAPI_BASE_URL=http://127.0.0.1:8001`, and `WATCHLIST_SEARCH_LIMIT=3`.

Before the clean run, Prisma migration status showed three existing pending migrations. `npm exec prisma -- migrate deploy` applied:

- `20260527100000_alert_engine_core`
- `20260531090000_add_document_text_extraction`
- `20260531110000_ai_analysis_lifecycle`

Clean run result:

| Run | HTTP status | filtersProcessed | tendersCreated | tendersUpdated | documentsUpserted | errorsCount | Raw payload in response |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| First clean run | 200 | 1 | 1 | 0 | 8 | 0 | No; summary keys only |
| Repeat run | 200 | 1 | 0 | 0 | 8 | 0 | No; summary keys only |

Notes:

- A temporary smoke saved filter named `Day 23 EIS smoke - fixture fallback` was created for the run and deactivated after verification.
- Two control tenders were inserted during a pre-migration smoke attempt before the missing `Document.extractionStatus` column was detected; after migrations, the clean first run imported the remaining control tender and documents.
- Total DB counts after first clean run and repeat run stayed stable: tenders `8 -> 8`, documents `18 -> 18`.
- Duplicate check: `noDuplicateTendersOnRepeat=true`, `noDuplicateDocumentsOnRepeat=true`, no duplicate control registry numbers, no duplicate source dedupe keys.

## Control Tenders

These are fixture fallback control records, not live EIS records.

| registryNumber | customer | price | deadline | documents count | sourceStage |
| --- | --- | ---: | --- | ---: | --- |
| `32413500001` | АО "Городская стоматология" | `1850000` | `2026-06-03T10:00:00+03:00` | 8 | `COMPLETED` |
| `32413500002` | ГАУЗ "Областной клинический центр" | `4200000` | `2026-05-30T16:00:00+03:00` | 0 | `EXPIRED` |
| `32413500003` | АО "Северная инфраструктура" | `2750000` | `2026-06-07T12:00:00+03:00` | 0 | `UNKNOWN` |

## Typed Errors And Validation

- Missing live config path is typed: `503 provider_not_configured`.
- Fake live upstream 429 path is typed: `429 upstream_rate_limited`.
- API response bodies are typed provider error JSON, not raw tracebacks.
- Next cron route response is a safe summary and does not include `hits`, `sourcePayload`, raw upstream payload, or secret values.

## Checks

- `uv run pytest tests/test_settings.py tests/test_eis223_fixture_provider.py tests/test_eis223_search_endpoint.py tests/test_eis223_normalize_endpoint.py`: 20 passed.
- `npm test -w apps/web`: 69 passed.
- Web typecheck was not rerun because no web source code was changed.

## Pilot Status

EIS remains a pilot blocker. Live document extraction is `BLOCKED_BY_MISSING_LIVE_EIS`. Required next step: provide live `EIS_PROVIDER_MODE=live`, `EIS_PROVIDER_BASE_URL`, and required `EIS_PROVIDER_API_KEY`, then run a live upstream smoke with 3-5 real normalized tenders before expanding to the pilot 10-15 tender/document sample and real PDF/document extraction.
