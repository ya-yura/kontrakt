# Agent Operating Instructions

This repository is one cohesive product. Do not split routine daily work into
extra branches, duplicated files, or parallel implementations unless the user
explicitly asks for that workflow.

## Product Line And Git

- Default to the current `main` product line for ordinary sprint work.
- Do not create `codex/*` or other task branches unless the user asks for a PR,
  an experiment, or a risky isolated change.
- Before staging, inspect `git status -sb` and stage only the files that belong
  to the current task.
- Prefer updating existing code, tests, runtime state, and instructions instead
  of adding duplicate entry points or parallel documentation.

## Runtime Registry

- Before starting, stopping, or verifying any long-running service, read
  `.agent-state/runtime-status.json`.
- If a needed service is marked `running`, verify that its URL responds and that
  the response is from the expected app/version before starting anything new.
- If a port is occupied, inspect the owning process command line. A listening
  port is not proof that the intended service is running.
- If the recorded service is stale, wrong, stopped, or moved to a different
  port, update `.agent-state/runtime-status.json` after the check or change.
- When updating a service entry, record `status`, `url`, `host`, `port`,
  `command`, `cwd`, `pid`, `startedAt`, `lastVerifiedAt`, `ownerAgent`, and a
  short note when the port choice is non-default.

## Browser Versus API Checks

- The in-app browser address bar performs a `GET`. It does not verify `POST`
  endpoints.
- A blank page, `404`, or `405` in the browser can be normal for a `POST`-only
  API route. Verify `POST` endpoints with `/docs`, `curl`, `Invoke-WebRequest`,
  HTTPie, or a real client request.
- Tests that use FastAPI `TestClient` prove the app works in-process. They do
  not prove that the currently running Uvicorn process has loaded the latest
  code.
- When the user references a localhost page or says the browser is wrong,
  verify the live server URL and method, not only the test suite.
- If the live server is stale, restart the existing app process when appropriate,
  then update `.agent-state/runtime-status.json`.

## FastAPI Endpoint Work

- Inspect existing routers, schemas, providers, fixtures, and tests before
  adding new API code.
- Do not add a second endpoint or provider path when the existing one should be
  extended.
- Keep fixture data clearly marked as fixture or deterministic test data. Do not
  imply it is real-time or live upstream data.
- Keep API errors typed. Do not expose raw tracebacks in provider error paths.
- Do not add database writes, cron/upsert work, AI/scoring, or unrelated
  endpoints unless the current task explicitly asks for them.
