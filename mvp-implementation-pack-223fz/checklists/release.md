# Release checklist

## Functional

- [ ] User can sign in.
- [ ] User can create SavedFilter.
- [ ] Watchlist manual run works.
- [ ] Cron watchlist run works.
- [ ] Real tenders appear in list.
- [ ] Tender card shows normalized data.
- [ ] Documents metadata appears.
- [ ] Source stage is derived and shown.
- [ ] Kanban stage is shown separately.
- [ ] Kanban movement works.
- [ ] Checklist works.
- [ ] Scoring works and is explainable.
- [ ] Manual decision override works.
- [ ] Deadline alerts work.
- [ ] Duplicate alerts are skipped.
- [ ] AI-summary works for text PDF.
- [ ] OCR required state works for scanned PDF.
- [ ] AI facts have source spans.
- [ ] Unknowns are shown.

## Security

- [ ] User cannot access another user's tender.
- [ ] User cannot access another user's document.
- [ ] Cron routes reject missing/wrong token.
- [ ] File proxy checks ownership.
- [ ] Telegram/email do not leak sensitive data.
- [ ] Secrets are not committed.

## Reliability

- [ ] Re-running watchlist does not duplicate tenders.
- [ ] Re-running alerts does not duplicate messages.
- [ ] AI failure does not break tender card.
- [ ] Upstream source failure is visible and retryable.
- [ ] DB migrations tested on staging.
- [ ] Rollback plan exists.

## Data quality

- [ ] 20-tender control sample checked for price.
- [ ] 20-tender control sample checked for customer.
- [ ] 20-tender control sample checked for deadline.
- [ ] 20-tender control sample checked for documents.
- [ ] 10-15 AI sample checked for deadlines.
- [ ] 10-15 AI sample checked for required documents.
- [ ] 10-15 AI sample checked for risks.

## Launch

- [ ] Production env vars configured.
- [ ] Production health checks pass.
- [ ] Cron schedule enabled.
- [ ] Monitoring/log review scheduled for first 48 hours.
- [ ] Pilot user onboarding instructions prepared.

