# Sprint 03: Operational loop, scoring, kanban, alerts

## Цель недели

Замкнуть рабочий процесс: взять закупку в работу, провести по стадиям, получить explainable decision и алерты.

## Инкремент

Пользователь управляет закупкой в канбане, видит checklist, score, decision reason и получает deadline/new match alerts без дублей.

## Scope

- Kanban board.
- Drag-and-drop or explicit move action.
- Stage-specific checklist state.
- SLA timer per stage.
- Owner comments.
- Rule-based scoring v1.
- Manual decision override.
- Alert engine for `deadline_t48/t24/t2` and `new_match`.
- Email and Telegram adapters.
- `AlertDelivery` journal.

## Out of scope

- AI extraction;
- change diff alerts beyond simple metadata detection;
- advanced analytics;
- multi-user teams.

## Tasks

### 1. Kanban board

- Board columns from `KanbanStage`.
- Cards with number, customer, price, deadline, score, top risk placeholder, checklist progress.
- Move action with ownership check.
- Keep source stage visible separately.

Acceptance:

- card moves persist;
- invalid stage rejected;
- terminal stages behave consistently.

### 2. Checklist state

- Stage templates in `KanbanStage.checklistTemplate`.
- Tender checklist state in JSONB.
- UI can check/uncheck items.
- Progress appears on board card.

Acceptance:

- checklist survives stage movement;
- malformed checklist input rejected by schema.

### 3. Scoring engine v1

Formula:

- fit: 0-30;
- economics: 0-20;
- execution risk: 0-20;
- compliance risk: 0-20;
- urgency: 0-10.

Hard blockers:

- unavailable license/certificate;
- unsupported region;
- security amount above company limit;
- deadline below minimum preparation window;
- unacceptable payment terms;
- unreachable mandatory experience/references.

Thresholds:

- `>= 70` -> `BID`;
- `50..69` -> `REVIEW`;
- `< 50` -> `NO_BID`.

Acceptance:

- score breakdown saved;
- decision reason human-readable;
- hard blocker overrides high score;
- manual override writes reason.

### 4. Alert engine

- Generate due alerts.
- Use idempotency key.
- Send email/Telegram through adapters.
- Log success/failure in `AlertDelivery`.
- Add alert history in tender card.

Acceptance:

- duplicate run does not resend;
- failed send can be retried safely;
- alert text contains only safe metadata and link.

## Tests

- Scoring table tests with hard blockers.
- Kanban move action tests.
- Checklist validation tests.
- Alert idempotency tests.
- Telegram/email adapter mocked tests.
- 90% no-duplicate alert pass on test set.

## Definition of done

- Пользователь может взять закупку в работу и провести ее по стадиям.
- Score сохраняется и объясняется.
- Deadline/new match alerts работают без дублей.
- Внутренний процесс не ломает source stage.

