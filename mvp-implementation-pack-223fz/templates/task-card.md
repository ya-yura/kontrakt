# Task card template

## Title

Короткое название задачи.

## Sprint

Ссылка на sprint-файл:

- `sprints/sprint-01-skeleton.md`
- `sprints/sprint-02-source-integration.md`
- `sprints/sprint-03-operational-loop.md`
- `sprints/sprint-04-ai-release.md`

## Context

Что уже есть и зачем нужна задача.

## Scope

Что нужно сделать:

- пункт 1;
- пункт 2;
- пункт 3.

## Out of scope

Что явно не делать:

- пункт 1;
- пункт 2.

## Touched areas

- `apps/web/...`
- `apps/api/...`
- `prisma/...`
- `docs/...`

## Acceptance criteria

- Given/When/Then 1.
- Given/When/Then 2.
- Given/When/Then 3.

## Tests

- Unit:
- Integration:
- E2E/manual:

## Constraints

- Next.js is the only DB writer.
- FastAPI returns DTO only.
- No AI facts without source spans.
- Preserve sourceStage/kanbanStage separation.

## Agent prompt

Используй `prompts/00-master-context.md` плюс профильный prompt из `prompts/`.

