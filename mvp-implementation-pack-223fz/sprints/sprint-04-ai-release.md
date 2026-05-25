# Sprint 04: AI-summary, document pipeline, release hardening

## Цель недели

Сократить ручное чтение документов и закрыть MVP до пилотного релиза.

## Инкремент

У закупки с документами можно получить AI-summary, риски, unknowns и source spans. Продукт готов к staging/production пилоту.

## Scope

- Document text extraction.
- OCR fallback path.
- `AIAnalysis` lifecycle.
- FastAPI `/v1/ai/summarize-document`.
- FastAPI `/v1/ai/summarize-tender`.
- FastAPI `/v1/ai/diff-document`.
- Next.js analysis cron.
- UI AI risk panel.
- Change diff for changed `payloadHash` or document hash.
- File proxy access control.
- Final QA, empty states, error handling.

## Out of scope

- автоматическая юридическая экспертиза;
- ML ranking;
- fine-tuning;
- full document management system.

## Tasks

### 1. Text extraction

- Implement `/v1/documents/extract-text`.
- Detect text layer.
- Return `TEXT_READY`, `OCR_REQUIRED` or `FAILED`.
- Store text checksum.

Acceptance:

- text PDF extracts text;
- scanned PDF does not fake text;
- failed document surfaces actionable error.

### 2. AIAnalysis lifecycle

- Create pending analysis by request.
- Run pending batch from cron.
- Validate LLM JSON.
- Save summary, requirements, risks, deadlines, citations, raw response.
- Version by `kind + inputHash + promptVersion`.

Acceptance:

- repeated run with same input does not create noisy duplicates;
- invalid LLM JSON becomes failed analysis with error message.

### 3. AI endpoints

- `/v1/ai/summarize-document`.
- `/v1/ai/summarize-tender`.
- `/v1/ai/diff-document`.
- Strict output schema.
- Prompt injection resistance: document text cannot override system instruction.

Acceptance:

- every extracted fact has source span;
- missing information goes to `unknowns`;
- confidence is reduced when key source docs are absent.

### 4. UI AI panel

- Compact summary.
- Required documents.
- Critical risks.
- Unknowns.
- Source citations.
- Status states: pending, running, text ready, OCR required, failed, completed.

Acceptance:

- user can understand what was analyzed and what was not;
- UI never presents AI as authoritative without citations.

### 5. Release hardening

- File proxy ownership.
- Error boundaries.
- Empty states.
- Loading states.
- Audit logs for cron and AI failures.
- Run release checklist.

## Tests

- Extract text unit tests.
- OCR required fixture.
- AI schema validation tests.
- Prompt injection fixture.
- Tender summary integration test.
- File proxy access control test.
- Control sample of 10-15 tenders.

## Definition of done

- AI extracts deadlines, required documents and 3-5 meaningful risks on control sample.
- No hallucinated facts without source spans.
- User can make a decision without reading full PDF manually.
- Release checklist passes.

