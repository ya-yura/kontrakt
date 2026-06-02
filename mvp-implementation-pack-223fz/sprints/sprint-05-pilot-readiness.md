# Sprint 05: Pilot readiness and live verification

## Цель

Перевести MVP из состояния `internal fixture/mock demo complete` в состояние, пригодное для ограниченного пилота. Это не спринт новых фич. Это спринт проверки реальных интеграций, стабилизации окружения и честного go/no-go решения.

## Исходный статус

Sprint 04 закрыт как `DONE` для internal fixture/mock MVP demo.

MVP readiness: `PARTIAL`, blocked for pilot.

Оставшиеся pilot blockers:

- Live EIS provider not verified.
- Live document extraction is `BLOCKED_BY_MISSING_LIVE_EIS` while live EIS credentials are absent.
- Live LLM not verified.
- Real email/Telegram delivery not verified.
- Real browser-click QA blocked by local tool/runtime issue.
- Live document download/extraction on real PDFs not verified; fixture/control documents are internal demo evidence only.
- OCR is not implemented and must remain honest as `OCR_REQUIRED`.
- Local Postgres default port `5439` issue needs environment decision.

## Недельный инкремент

К концу спринта должен быть один из двух честных результатов:

- `READY_FOR_LIMITED_PILOT`: реальные интеграции проверены в безопасных каналах, браузерный путь воспроизводим, критических блокеров нет.
- `BLOCKED_FOR_PILOT`: есть конкретный список оставшихся blockers с владельцем, способом проверки и следующим действием.

## Scope

- Stabilize local/staging runtime and ports.
- Decide and document Postgres port/environment policy.
- Verify live EIS provider with safe query and rate-limit awareness.
- Verify live document download/extraction on real PDFs only after live EIS credentials exist.
- Verify live LLM with safe non-sensitive sample and source-spans validation.
- Verify real Telegram/email delivery in staging-safe channels.
- Complete browser-click QA for full MVP path.
- Reconfirm cron auth, runtime locks, file proxy cross-owner denial, alert idempotency.
- Update release candidate docs and go/no-go decision.

## Out of scope

- New product features.
- ML scoring.
- Full OCR implementation.
- Production-scale load testing.
- Automatic bid submission.
- Legal advice automation.
- Sending sensitive data to Telegram/email/LLM.

## Definition of done

- Environment runtime registry is accurate.
- Postgres port and startup policy documented.
- Live EIS smoke test result recorded.
- Live document extraction result recorded as verified, or explicitly `BLOCKED_BY_MISSING_LIVE_EIS` when live EIS credentials are missing.
- Live LLM smoke test result recorded or explicitly blocked by missing credentials.
- Real Telegram/email staging delivery result recorded or explicitly blocked by missing credentials.
- Browser-click QA path completed or blocked by a concrete reproducible issue.
- File proxy cross-owner denial verified.
- Release docs reflect truth without overclaiming.
- Go/no-go decision recorded.
