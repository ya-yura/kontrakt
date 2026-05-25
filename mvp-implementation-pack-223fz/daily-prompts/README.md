# Daily prompts index

Готовые недельные наборы задач-промптов для AI-агентов.

## Доступные недели

- `week-01-2026-05-25` - Sprint 01: product skeleton and read-only loop.
- `week-02-2026-06-01` - Sprint 02: real source integration and normalized tender card.

## Правило экономии токенов

Daily prompt самодостаточен. Агенту не нужно перечитывать `deep-research-report.md`, sprint-файлы и весь `mvp-implementation-pack-223fz`, если нужный контекст уже есть внутри prompt.

Агент должен читать только релевантный код проекта и запускать только проверки, нужные для текущего дня.

## Runtime registry

Перед запуском любого сервера агент должен проверить `.agent-state/runtime-status.json`.

Если нужный сервис уже `running` и URL отвечает, агент использует существующий URL. Новый порт выбирается только если существующий сервис не отвечает и запись помечена как `stale`.
